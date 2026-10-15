import { createHash, timingSafeEqual } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { buildPasswordResetEmailHtml, buildVerificationEmailHtml } from '@/lib/email-templates';
import { BRAND } from '@/lib/brand';

/**
 * Transactional mail delivery. Spring Boot's `AuthMailService` POSTs here with a shared secret;
 * this route renders the template and hands the message to an SMTP server.
 *
 * The provider behind this seam is Stalwart, self-hosted, reached over the internal Docker
 * network. It used to be Resend. Everything above the transport — the secret check, the field
 * validation, the subject and template maps — is provider-agnostic and did not change with the
 * swap, which is the whole reason this route exists rather than the server sending mail itself.
 *
 * Runs on the Node runtime, which is the default for route handlers (the `edge` runtime is
 * deprecated in Next 16 and could not run nodemailer at all — it needs `net`/`tls`).
 */

type MailType = 'verification' | 'password-reset';

const SUBJECT_MAP: Record<MailType, string> = {
  verification: `Verify your ${BRAND.name} account`,
  'password-reset': `Reset your ${BRAND.name} password`,
};

const TEMPLATE_MAP: Record<MailType, (name: string, actionUrl: string) => string> = {
  verification: buildVerificationEmailHtml,
  'password-reset': buildPasswordResetEmailHtml,
};

const VALID_TYPES = new Set<string>(Object.keys(SUBJECT_MAP));

/**
 * Constant-time comparison of the shared secret.
 *
 * `timingSafeEqual` throws on length mismatch, so both sides are hashed first: that yields two
 * fixed-length digests, which removes the early-return-on-length branch rather than just moving
 * the leak. The previous `!==` compared byte by byte and short-circuited on the first difference.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

let cachedTransport: Transporter | undefined;

/**
 * The SMTP transport, built once and reused.
 *
 * Pooled and module-scoped on purpose: a transport per request means a fresh TCP and TLS
 * handshake for every verification email, which is pure latency on the registration path.
 *
 * Defaults target the deployment this ships into — Stalwart on the shared Docker network, port
 * 465 with implicit TLS. Note 587/STARTTLS is published by that container but **not enabled** in
 * the running server; pointing at it yields ECONNREFUSED. 465 is the working submission port.
 *
 * On certificate verification: the internal hostname (`stalwart`) never matches the name on
 * Stalwart's certificate (`mail.<mail-domain>`), so a naive client has to choose between failing
 * and not checking at all. It does not: `SMTP_TLS_SERVERNAME` tells TLS which name to *verify*
 * while still connecting to `SMTP_HOST`, which is what SNI is for. Verification therefore stays
 * on by default and `SMTP_TLS_INSECURE` exists only for a transport whose certificate cannot be
 * validated at all (a self-signed deployment).
 */
function mailTransport(): Transporter {
  if (cachedTransport) {
    return cachedTransport;
  }

  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    throw new Error('SMTP_HOST is not set — there is no mail server to deliver through');
  }

  const port = Number(process.env.SMTP_PORT ?? '465');
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`SMTP_PORT is not a valid port: ${process.env.SMTP_PORT}`);
  }

  // Implicit TLS unless explicitly turned off. `secure: false` means STARTTLS, which is the
  // right setting for 25 and 587 and the wrong one for 465.
  const secure = process.env.SMTP_SECURE !== '0';

  const user = process.env.SMTP_USER?.trim() || process.env.SMTP_USERNAME?.trim();
  const pass = process.env.SMTP_PASSWORD;
  if (user && !pass) {
    throw new Error('SMTP_USER is set but SMTP_PASSWORD is empty — authentication would fail');
  }

  const servername = process.env.SMTP_TLS_SERVERNAME?.trim();
  const rejectUnauthorized = process.env.SMTP_TLS_INSECURE !== '1';

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    // Omitted rather than passed empty, which supports an unauthenticated internal relay
    // (Stalwart's :25 from a trusted network). Authenticated submission is preferred; the
    // production preflight in prod_deploy.sh requires credentials.
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      ...(servername ? { servername } : {}),
      rejectUnauthorized,
    },
    pool: true,
    maxConnections: 2,
  });
  return cachedTransport;
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-internal-mail-secret');
  const expected = process.env.INTERNAL_MAIL_SECRET;
  if (!secret || !expected || !secretMatches(secret, expected)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, toEmail, name, actionUrl } = body as Record<string, unknown>;

  if (!type || typeof type !== 'string' || !VALID_TYPES.has(type)) {
    return Response.json(
      { error: `Invalid or missing type. Must be one of: ${[...VALID_TYPES].join(', ')}` },
      { status: 400 },
    );
  }
  if (!toEmail || typeof toEmail !== 'string') {
    return Response.json({ error: 'Missing required field: toEmail' }, { status: 400 });
  }
  if (!name || typeof name !== 'string') {
    return Response.json({ error: 'Missing required field: name' }, { status: 400 });
  }
  if (!actionUrl || typeof actionUrl !== 'string') {
    return Response.json({ error: 'Missing required field: actionUrl' }, { status: 400 });
  }

  const mailType = type as MailType;

  try {
    const info = await mailTransport().sendMail({
      from: process.env.MAIL_FROM || BRAND.mailFrom,
      to: toEmail,
      subject: SUBJECT_MAP[mailType],
      html: TEMPLATE_MAP[mailType](name, actionUrl),
    });
    return Response.json({ success: true, id: info.messageId }, { status: 200 });
  } catch (error) {
    // 502, not 500, and deliberately: AuthMailService turns any non-2xx into
    // EmailDeliveryException, which the server maps to 503. Changing this status would make a
    // mail outage look like a client error to every caller.
    //
    // Logged with the recipient's address because this is the only trace a failed delivery
    // leaves anywhere — there is no metrics or alerting pipeline in this deployment — and an
    // operator grepping for it after a user reports a missing email needs to know who was
    // affected. The error carries the SMTP reply, which is what distinguishes "domain not
    // registered in Stalwart" from "cannot reach the mail server".
    console.error(`[mail] delivery failed type=${mailType} to=${toEmail}:`, error);
    return Response.json({ error: 'Failed to send email' }, { status: 502 });
  }
}
