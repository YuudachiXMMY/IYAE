import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSend = vi.fn();
const mockVerify = vi.fn();
const mockCreateTransport = vi.fn<(options: unknown) => {
  sendMail: typeof mockSend;
  verify: typeof mockVerify;
}>(() => ({ sendMail: mockSend, verify: mockVerify }));

vi.mock('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport,
}));

const VALID_SECRET = 'test-secret';

/**
 * B-10's alerting half. The module under test keeps the transport and the last-delivery record
 * in module scope, so each case re-imports against a reset registry; otherwise one test's
 * recorded failure would leak into the next and the signal under test would be fabricated.
 */
async function loadRoutes() {
  const health = (await import('@/app/api/internal/mail/health/route')).GET;
  const send = (await import('@/app/api/internal/mail/send/route')).POST;
  return { health, send };
}

function healthRequest(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers['x-internal-mail-secret'] = secret;
  return new Request('http://localhost/api/internal/mail/health', { method: 'GET', headers });
}

function sendRequest(): Request {
  return new Request('http://localhost/api/internal/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-mail-secret': VALID_SECRET,
    },
    body: JSON.stringify({
      type: 'verification',
      toEmail: 'user@example.com',
      name: 'Test User',
      actionUrl: 'https://example.com/verify?token=abc',
    }),
  });
}

describe('GET /api/internal/mail/health', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.INTERNAL_MAIL_SECRET = VALID_SECRET;
    process.env.MAIL_FROM = 'noreply@i-yae.com';
    process.env.SMTP_HOST = 'stalwart';
    mockVerify.mockResolvedValue(true);
    mockSend.mockResolvedValue({ messageId: 'id' });
  });

  afterEach(() => {
    for (const key of ['INTERNAL_MAIL_SECRET', 'MAIL_FROM', 'SMTP_HOST', 'SMTP_PORT']) {
      delete process.env[key];
    }
    vi.clearAllMocks();
  });

  it('refuses without the shared secret', async () => {
    const { health } = await loadRoutes();
    const res = await health(healthRequest());
    expect(res.status).toBe(403);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('reports UP when the transport connects and nothing has been sent yet', async () => {
    // "Never sent" is healthy. The alternative — treating it as unknown/down — would alarm on
    // every fresh deploy until the first registration.
    const { health } = await loadRoutes();
    const res = await health(healthRequest(VALID_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('UP');
    expect(body.transport).toBe('UP');
    expect(body.lastSend).toEqual({ state: 'never' });
  });

  it('reports DOWN when the transport cannot connect', async () => {
    // This is the signal that exists with zero traffic — the one a "did any send fail?" check
    // cannot provide on a deployment nobody has registered on yet.
    mockVerify.mockRejectedValue(new Error('ECONNREFUSED 465'));
    const { health } = await loadRoutes();
    const res = await health(healthRequest(VALID_SECRET));

    const body = await res.json();
    expect(body.status).toBe('DOWN');
    expect(body.transport).toBe('DOWN');
    expect(body.transportReason).toContain('ECONNREFUSED');
  });

  it('reports DOWN when the transport is up but the last real send failed', async () => {
    // The converse case, and the one most likely when adding a new sending domain: the mail
    // server accepts the connection and the credentials, then refuses to relay for the domain.
    // transporter.verify() cannot see that; only a real send can.
    mockSend.mockRejectedValue(new Error('550 relay not permitted'));
    const { health, send } = await loadRoutes();

    const sendRes = await send(sendRequest());
    expect(sendRes.status).toBe(502);

    const res = await health(healthRequest(VALID_SECRET));
    const body = await res.json();
    expect(body.status).toBe('DOWN');
    expect(body.transport).toBe('UP');
    expect(body.lastSend.state).toBe('failed');
    expect(body.lastSend.reason).toContain('550');
  });

  it('returns to UP once a later send succeeds', async () => {
    // Keeping only the last outcome is what makes recovery automatic — a transient failure must
    // not latch the alert on forever.
    mockSend.mockRejectedValueOnce(new Error('timeout'));
    const { health, send } = await loadRoutes();

    await send(sendRequest());
    expect((await (await health(healthRequest(VALID_SECRET))).json()).status).toBe('DOWN');

    await send(sendRequest());
    const body = await (await health(healthRequest(VALID_SECRET))).json();
    expect(body.status).toBe('UP');
    expect(body.lastSend.state).toBe('ok');
  });

  it('answers 200 even when unhealthy, because the server owns the status code', async () => {
    // A non-2xx here would be indistinguishable, to the server's HTTP client, from the route
    // being unreachable — and the body is the actual answer.
    mockVerify.mockRejectedValue(new Error('down'));
    const { health } = await loadRoutes();
    expect((await health(healthRequest(VALID_SECRET))).status).toBe(200);
  });

  it('caches the transport check so a monitor cannot open an SMTP connection per hit', async () => {
    // This endpoint sits behind a public health route on the server. Uncached, polling it is a
    // connection amplifier against a mail server shared with four other services.
    const { health } = await loadRoutes();
    await health(healthRequest(VALID_SECRET));
    await health(healthRequest(VALID_SECRET));
    await health(healthRequest(VALID_SECRET));

    expect(mockVerify).toHaveBeenCalledOnce();
  });

  it('re-checks the transport once the cache window has passed', async () => {
    const { health } = await loadRoutes();
    const { checkTransport } = await import('@/lib/mail-transport');

    await checkTransport(0);
    await checkTransport(29_000);
    expect(mockVerify).toHaveBeenCalledOnce();

    await checkTransport(31_000);
    expect(mockVerify).toHaveBeenCalledTimes(2);

    // And the route itself still works against the same cache.
    expect((await health(healthRequest(VALID_SECRET))).status).toBe(200);
  });

  it('reports DOWN rather than throwing when SMTP is not configured at all', async () => {
    delete process.env.SMTP_HOST;
    const { health } = await loadRoutes();
    const res = await health(healthRequest(VALID_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('DOWN');
    expect(body.transportReason).toContain('SMTP_HOST');
  });
});
