import { createHash, timingSafeEqual } from 'node:crypto';
import { checkTransport, lastSendOutcome } from '@/lib/mail-transport';

/**
 * Whether transactional mail can actually be delivered. Read by the server's
 * `GET /api/health/mail`, which is what an uptime monitor watches.
 *
 * B-10's second half. The finding was not only that nothing validated the mail configuration,
 * but that a delivery failure produced no signal of any kind: `AuthService.register` catches
 * `EmailDeliveryException` and only `log.warn`s, so registration returns 201 and the user simply
 * never receives a link. With login gated on `emailVerified` in production, that account is
 * permanently stuck — and the only trace was a line in container stdout nobody is paged to read.
 *
 * Two signals, because neither is sufficient alone:
 *
 *   - `transport` — connects and authenticates (`verify()`, no message sent). This is the one
 *     that exists with zero traffic. On its own it reports healthy when the transport is fine
 *     but the mail server refuses to relay for the sending domain, which is the single most
 *     likely misconfiguration when adding a new sending domain.
 *   - `lastSend` — how the most recent real delivery went. Catches exactly that refusal, and on
 *     its own reports healthy on a fresh deploy that has never sent anything.
 *
 * Secret-gated like its sibling: this is an internal route, and the public surface is the
 * server's health endpoint, which deliberately exposes far less.
 */

function secretMatches(provided: string, expected: string): boolean {
  // Hashed first so there is no length-dependent branch — see the send route for the full note.
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = request.headers.get('x-internal-mail-secret');
  const expected = process.env.INTERNAL_MAIL_SECRET;
  if (!secret || !expected || !secretMatches(secret, expected)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const transport = await checkTransport();
  const lastSend = lastSendOutcome();

  // `never` is healthy: the transport works and nothing has been sent yet. A *failed* last send
  // is not — it stays degraded until a later send succeeds, which is what keeping only the last
  // outcome gives us for free.
  const healthy = transport.ok && lastSend.state !== 'failed';

  return Response.json(
    {
      status: healthy ? 'UP' : 'DOWN',
      transport: transport.ok ? 'UP' : 'DOWN',
      ...(transport.reason ? { transportReason: transport.reason } : {}),
      lastSend,
    },
    // 200 even when unhealthy: the body is the answer, and the *server* decides the status code
    // its own public endpoint returns. A non-2xx here would be indistinguishable, to
    // AuthMailService's HTTP client, from the route being unreachable.
    { status: 200 },
  );
}
