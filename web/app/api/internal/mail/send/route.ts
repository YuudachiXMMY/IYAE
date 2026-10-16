import { createHash, timingSafeEqual } from 'node:crypto';
import { mailTransport, recordSendFailure, recordSendSuccess } from '@/lib/mail-transport';
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
    recordSendSuccess();
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
    const reason = error instanceof Error ? error.message : String(error);
    // Recorded so GET /api/internal/mail/health — and the server's /api/health/mail above it —
    // can report that real delivery is failing. A transport that connects and authenticates
    // still gets refused when the sending domain is not registered on the mail server, and
    // `verify()` cannot see that; only a real send can.
    recordSendFailure(reason);
    console.error(`[mail] delivery failed type=${mailType} to=${toEmail}:`, error);
    return Response.json({ error: 'Failed to send email' }, { status: 502 });
  }
}
