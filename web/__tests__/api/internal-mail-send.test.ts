import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSend = vi.fn();

/** Only the options this route actually sets — enough to type the assertions without casts. */
type TransportOptions = {
  host?: string;
  port?: number;
  secure?: boolean;
  pool?: boolean;
  auth?: { user: string; pass: string };
  tls?: { servername?: string; rejectUnauthorized?: boolean };
};

const mockCreateTransport = vi.fn((_options: TransportOptions) => ({ sendMail: mockSend }));

vi.mock('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport,
}));

import { BRAND } from '@/lib/brand';

const VALID_SECRET = 'test-secret';

/**
 * The route caches its SMTP transport at module scope — one pooled transport per process, so a
 * verification email does not pay for a fresh TLS handshake. That makes the module stateful, so
 * every case re-imports it against a reset registry instead of sharing one instance; otherwise a
 * test that changes SMTP_* would silently assert against the transport an earlier test built.
 */
async function loadRoute() {
  return (await import('@/app/api/internal/mail/send/route')).POST;
}

function makeRequest(body: unknown, secret?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret !== undefined) {
    headers['x-internal-mail-secret'] = secret;
  }
  return new Request('http://localhost/api/internal/mail/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const VERIFICATION_BODY = {
  type: 'verification',
  toEmail: 'user@example.com',
  name: 'Test User',
  actionUrl: 'https://example.com/verify?token=abc',
};

describe('POST /api/internal/mail/send', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.INTERNAL_MAIL_SECRET = VALID_SECRET;
    process.env.MAIL_FROM = 'noreply@iyae.ca';
    process.env.SMTP_HOST = 'stalwart';
    mockSend.mockResolvedValue({ messageId: 'test-email-id' });
  });

  afterEach(() => {
    for (const key of [
      'INTERNAL_MAIL_SECRET', 'MAIL_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE',
      'SMTP_USER', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_TLS_SERVERNAME', 'SMTP_TLS_INSECURE',
    ]) {
      delete process.env[key];
    }
    vi.clearAllMocks();
  });

  // --- Auth ---

  it('returns 403 when x-internal-mail-secret header is missing', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest(VERIFICATION_BODY));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Forbidden');
  });

  it('returns 403 when x-internal-mail-secret header is wrong', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest(VERIFICATION_BODY, 'wrong-secret'));
    expect(res.status).toBe(403);
  });

  it('returns 403 for a secret of a different length', async () => {
    // The comparison hashes both sides before `timingSafeEqual`, which throws on a length
    // mismatch. Without the hash this input would either throw a 500 or need an early
    // length-dependent return — this case pins that it is a plain 403.
    const POST = await loadRoute();
    const res = await POST(makeRequest(VERIFICATION_BODY, 'x'));
    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 403 when INTERNAL_MAIL_SECRET is not configured', async () => {
    // Must not degrade into "any secret matches", which is what comparing against an
    // undefined expected value could do.
    delete process.env.INTERNAL_MAIL_SECRET;
    const POST = await loadRoute();
    const res = await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  // --- Validation ---

  it('returns 400 when type is missing', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest(
      { toEmail: 'user@example.com', name: 'Test', actionUrl: 'https://example.com/verify' },
      VALID_SECRET,
    ));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/type/i);
  });

  it('returns 400 when type is invalid', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest(
      { type: 'newsletter', toEmail: 'user@example.com', name: 'Test', actionUrl: 'https://example.com' },
      VALID_SECRET,
    ));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/type/i);
  });

  it('returns 400 when toEmail is missing', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest(
      { type: 'verification', name: 'Test', actionUrl: 'https://example.com/verify' },
      VALID_SECRET,
    ));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/toEmail/);
  });

  it('returns 400 when name is missing', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest(
      { type: 'verification', toEmail: 'user@example.com', actionUrl: 'https://example.com/verify' },
      VALID_SECRET,
    ));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/name/);
  });

  it('returns 400 when actionUrl is missing', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest(
      { type: 'verification', toEmail: 'user@example.com', name: 'Test' },
      VALID_SECRET,
    ));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/actionUrl/);
  });

  // --- Success paths ---

  it('sends verification email successfully', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // nodemailer reports the queued id as `messageId`, where Resend used `data.id`.
    expect(body.id).toBe('test-email-id');

    expect(mockSend).toHaveBeenCalledOnce();
    const sendArgs = mockSend.mock.calls[0][0];
    expect(sendArgs.subject).toBe('Verify your IYAE account');
    expect(sendArgs.to).toBe('user@example.com');
    expect(sendArgs.from).toBe('noreply@iyae.ca');
    expect(sendArgs.html).toContain('Verify Email Address');
  });

  it('sends password-reset email successfully', async () => {
    const POST = await loadRoute();
    const res = await POST(makeRequest(
      { type: 'password-reset', toEmail: 'user@example.com', name: 'Test User', actionUrl: 'https://example.com/reset?token=xyz' },
      VALID_SECRET,
    ));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);

    const sendArgs = mockSend.mock.calls[0][0];
    expect(sendArgs.subject).toBe('Reset your IYAE password');
    expect(sendArgs.html).toContain('Reset Password');
  });

  it('falls back to BRAND.mailFrom when MAIL_FROM is not set', async () => {
    delete process.env.MAIL_FROM;
    const POST = await loadRoute();
    const res = await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    expect(res.status).toBe(200);
    expect(mockSend.mock.calls[0][0].from).toBe(BRAND.mailFrom);
  });

  it('escapes the action URL into the href attribute', async () => {
    // A-29. Every other interpolation in email-templates.ts goes through escapeHtml; this one
    // did not, leaving the single attribute-injection sink in the file one externally-controlled
    // value away from being live.
    const POST = await loadRoute();
    await POST(makeRequest(
      { ...VERIFICATION_BODY, actionUrl: 'https://example.com/verify?a=1&b=2" onmouseover="x' },
      VALID_SECRET,
    ));
    const html = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain('onmouseover="x');
    expect(html).toContain('&amp;b=2');
    expect(html).toContain('&quot;');
  });

  // --- SMTP transport ---

  it('builds the transport for implicit TLS on 465 by default', async () => {
    // 587/STARTTLS is published by the Stalwart container but not enabled in the running
    // server — pointing at it yields ECONNREFUSED. 465 is the working submission port, so it
    // is the default rather than something each deployment has to remember.
    const POST = await loadRoute();
    await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));

    expect(mockCreateTransport).toHaveBeenCalledOnce();
    const opts = mockCreateTransport.mock.calls[0][0];
    expect(opts.host).toBe('stalwart');
    expect(opts.port).toBe(465);
    expect(opts.secure).toBe(true);
    expect(opts.pool).toBe(true);
  });

  it('verifies the certificate against SMTP_TLS_SERVERNAME rather than the connect host', async () => {
    // The internal hostname never matches the name on the mail server's certificate, and the
    // alternative the sibling apps use is to stop verifying altogether. SNI solves it properly:
    // connect to `stalwart`, verify `mail.<domain>`.
    process.env.SMTP_TLS_SERVERNAME = 'mail.example.com';
    const POST = await loadRoute();
    await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));

    const tls = mockCreateTransport.mock.calls[0][0].tls!;
    expect(tls.servername).toBe('mail.example.com');
    expect(tls.rejectUnauthorized).toBe(true);
  });

  it('keeps certificate verification on unless SMTP_TLS_INSECURE is explicitly 1', async () => {
    const POST = await loadRoute();
    await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    const tls = mockCreateTransport.mock.calls[0][0].tls!;
    expect(tls.rejectUnauthorized).toBe(true);
    expect(tls.servername).toBeUndefined();
  });

  it('disables certificate verification when SMTP_TLS_INSECURE=1', async () => {
    process.env.SMTP_TLS_INSECURE = '1';
    const POST = await loadRoute();
    await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    const tls = mockCreateTransport.mock.calls[0][0].tls!;
    expect(tls.rejectUnauthorized).toBe(false);
  });

  it('authenticates when credentials are supplied', async () => {
    process.env.SMTP_USER = 'iyae@example.com';
    process.env.SMTP_PASSWORD = 'app-password';
    const POST = await loadRoute();
    await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    const opts = mockCreateTransport.mock.calls[0][0];
    expect(opts.auth).toEqual({ user: 'iyae@example.com', pass: 'app-password' });
  });

  it('omits auth entirely for an unauthenticated internal relay', async () => {
    // Passing an empty user/pass is not the same as passing none: nodemailer would attempt
    // AUTH and the server would reject it. The relay-on-a-trusted-network setup needs neither.
    const POST = await loadRoute();
    await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    const opts = mockCreateTransport.mock.calls[0][0];
    expect(opts.auth).toBeUndefined();
  });

  it('reuses one pooled transport across requests', async () => {
    const POST = await loadRoute();
    await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockCreateTransport).toHaveBeenCalledOnce();
  });

  // --- Error handling ---

  it('returns 502 when the SMTP server rejects the message', async () => {
    // 502 and not 500 on purpose: AuthMailService turns any non-2xx into
    // EmailDeliveryException -> 503. A mail outage must not read as a client error.
    mockSend.mockRejectedValue(new Error('550 relay not permitted'));
    const POST = await loadRoute();
    const res = await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('Failed to send email');
  });

  it('returns 502 rather than throwing when SMTP_HOST is not configured', async () => {
    // The B-10 failure mode: an unconfigured mail path must fail loudly and reach the server as
    // a delivery failure, not surface as a 500 or, worse, a 200 that sent nothing.
    delete process.env.SMTP_HOST;
    const POST = await loadRoute();
    const res = await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    expect(res.status).toBe(502);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 502 when a user is set with no password', async () => {
    process.env.SMTP_USER = 'iyae@example.com';
    delete process.env.SMTP_PASSWORD;
    const POST = await loadRoute();
    const res = await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    expect(res.status).toBe(502);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 502 when SMTP_PORT is not a valid port', async () => {
    process.env.SMTP_PORT = 'not-a-port';
    const POST = await loadRoute();
    const res = await POST(makeRequest(VERIFICATION_BODY, VALID_SECRET));
    expect(res.status).toBe(502);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
