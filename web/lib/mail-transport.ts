import nodemailer, { type Transporter } from 'nodemailer';

/**
 * The SMTP transport and the record of how mail delivery is actually going.
 *
 * One module owns both because two routes need them — `/api/internal/mail/send` and
 * `/api/internal/mail/health` — and this repository has been bitten three times by two places
 * owning one piece of state (the demo-cart key, the community-state entry, the asset allow-list).
 *
 * Node runtime only: nodemailer needs `net`/`tls`. That is the default for route handlers; the
 * `edge` runtime is deprecated in Next 16 and could not load this at all.
 */

export type MailOutcome =
  | { state: 'never' }
  | { state: 'ok'; at: string }
  | { state: 'failed'; at: string; reason: string };

/**
 * Only the *last* outcome is kept, deliberately. A success after a failure means delivery is
 * working again, so one slot is the whole state machine — and it keeps a transient failure from
 * latching permanently once real traffic resumes.
 *
 * In-memory, therefore per-process and reset by a restart. That matches the rest of this
 * deployment (`RateLimitFilter` is per-instance too) and is acceptable because the canary
 * re-establishes the transport signal within one scheduler tick of a restart.
 */
let lastOutcome: MailOutcome = { state: 'never' };

export function recordSendSuccess(): void {
  lastOutcome = { state: 'ok', at: new Date().toISOString() };
}

export function recordSendFailure(reason: string): void {
  lastOutcome = { state: 'failed', at: new Date().toISOString(), reason };
}

export function lastSendOutcome(): MailOutcome {
  return lastOutcome;
}

let cachedTransport: Transporter | undefined;

/**
 * The SMTP transport, built once and reused.
 *
 * Pooled and module-scoped on purpose: a transport per request means a fresh TCP and TLS
 * handshake for every verification email, which is pure latency on the registration path.
 *
 * Defaults target the deployment this ships into — the mail server on the shared Docker network,
 * port 465 with implicit TLS. Note 587/STARTTLS is published by that container but **not
 * enabled** in the running server; pointing at it yields ECONNREFUSED. 465 is the working
 * submission port.
 *
 * On certificate verification: the internal hostname never matches the name on the mail server's
 * certificate, so a naive client has to choose between failing and not checking at all. It does
 * not have to: `SMTP_TLS_SERVERNAME` tells TLS which name to *verify* while still connecting to
 * `SMTP_HOST`, which is what SNI is for. Verification therefore stays on by default, and
 * `SMTP_TLS_INSECURE` exists only for a transport whose certificate cannot be validated at all.
 * The sibling services on this host all take the switch-it-off route; this one does not.
 *
 * Throws on a configuration it cannot use. Callers turn that into a 502 rather than letting it
 * escape — an unconfigured mail path must read as a delivery failure, which is what the server
 * maps to a 503, not as a 500.
 */
export function mailTransport(): Transporter {
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

  // Both spellings are read because this deployment already contains both: the app's own
  // compose uses SMTP_USERNAME for the (dead) server-side block while every sibling service on
  // the host uses SMTP_USER, and they share one generated .env.
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
    // Omitted rather than passed empty, which supports an unauthenticated internal relay from a
    // trusted network. Authenticated submission is preferred; an empty user/pass is not the same
    // as none — nodemailer would attempt AUTH and the server would reject it.
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

export type TransportCheck = { ok: boolean; reason?: string };

/**
 * How long a transport check is reused. The health endpoint behind this is reachable without
 * credentials (it sits under the public `/api/health/**` namespace on the server side), and an
 * uncached check opens an SMTP connection per hit — against a mail server shared with four other
 * services. 30s is below any sane monitor interval, so a monitor still sees fresh results.
 */
const CHECK_TTL_MS = 30_000;

let cachedCheck: { at: number; result: TransportCheck } | undefined;

/**
 * Connects and authenticates without sending anything (`transporter.verify()`).
 *
 * This is the signal that exists with **zero traffic**, which is the whole point: "no failures
 * yet" is not the same as "delivery works", and on a fresh deploy the two are
 * indistinguishable without it. It is not sufficient on its own either — a transport that
 * connects and authenticates will still be refused if the sending domain is not registered on
 * the mail server, and only a real send reveals that. Hence both this and
 * {@link lastSendOutcome}.
 */
export async function checkTransport(now: number = Date.now()): Promise<TransportCheck> {
  if (cachedCheck && now - cachedCheck.at < CHECK_TTL_MS) {
    return cachedCheck.result;
  }

  let result: TransportCheck;
  try {
    await mailTransport().verify();
    result = { ok: true };
  } catch (error) {
    result = { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  cachedCheck = { at: now, result };
  return result;
}
