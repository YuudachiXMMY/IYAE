import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

import { POST } from '@/app/api/internal/mail/send/route';

const VALID_SECRET = 'test-secret';

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

describe('POST /api/internal/mail/send', () => {
  beforeEach(() => {
    process.env.INTERNAL_MAIL_SECRET = VALID_SECRET;
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.MAIL_FROM = 'noreply@clossette.ca';
    mockSend.mockResolvedValue({ data: { id: 'test-email-id' }, error: null });
  });

  afterEach(() => {
    delete process.env.INTERNAL_MAIL_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
    vi.clearAllMocks();
  });

  // --- Auth ---

  it('returns 403 when x-internal-mail-secret header is missing', async () => {
    const req = makeRequest({
      type: 'verification',
      toEmail: 'user@example.com',
      name: 'Test',
      actionUrl: 'https://example.com/verify',
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 when x-internal-mail-secret header is wrong', async () => {
    const req = makeRequest(
      { type: 'verification', toEmail: 'user@example.com', name: 'Test', actionUrl: 'https://example.com/verify' },
      'wrong-secret',
    );
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  // --- Validation ---

  it('returns 400 when type is missing', async () => {
    const req = makeRequest(
      { toEmail: 'user@example.com', name: 'Test', actionUrl: 'https://example.com/verify' },
      VALID_SECRET,
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/type/i);
  });

  it('returns 400 when type is invalid', async () => {
    const req = makeRequest(
      { type: 'newsletter', toEmail: 'user@example.com', name: 'Test', actionUrl: 'https://example.com' },
      VALID_SECRET,
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/type/i);
  });

  it('returns 400 when toEmail is missing', async () => {
    const req = makeRequest(
      { type: 'verification', name: 'Test', actionUrl: 'https://example.com/verify' },
      VALID_SECRET,
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/toEmail/);
  });

  it('returns 400 when name is missing', async () => {
    const req = makeRequest(
      { type: 'verification', toEmail: 'user@example.com', actionUrl: 'https://example.com/verify' },
      VALID_SECRET,
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/);
  });

  it('returns 400 when actionUrl is missing', async () => {
    const req = makeRequest(
      { type: 'verification', toEmail: 'user@example.com', name: 'Test' },
      VALID_SECRET,
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/actionUrl/);
  });

  // --- Success paths ---

  it('sends verification email successfully', async () => {
    const req = makeRequest(
      { type: 'verification', toEmail: 'user@example.com', name: 'Test User', actionUrl: 'https://example.com/verify?token=abc' },
      VALID_SECRET,
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.id).toBe('test-email-id');

    expect(mockSend).toHaveBeenCalledOnce();
    const sendArgs = mockSend.mock.calls[0][0];
    expect(sendArgs.subject).toBe('Verify your Clossette account');
    expect(sendArgs.to).toBe('user@example.com');
    expect(sendArgs.from).toBe('noreply@clossette.ca');
    expect(sendArgs.html).toContain('Verify Email Address');
  });

  it('sends password-reset email successfully', async () => {
    const req = makeRequest(
      { type: 'password-reset', toEmail: 'user@example.com', name: 'Test User', actionUrl: 'https://example.com/reset?token=xyz' },
      VALID_SECRET,
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const sendArgs = mockSend.mock.calls[0][0];
    expect(sendArgs.subject).toBe('Reset your Clossette password');
    expect(sendArgs.html).toContain('Reset Password');
  });

  // --- Error handling ---

  it('returns 502 when Resend SDK returns an error', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'API error', name: 'api_error', statusCode: 500 } });
    const req = makeRequest(
      { type: 'verification', toEmail: 'user@example.com', name: 'Test User', actionUrl: 'https://example.com/verify' },
      VALID_SECRET,
    );
    const res = await POST(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('Failed to send email');
  });

  it('uses default from address when MAIL_FROM is not set', async () => {
    delete process.env.MAIL_FROM;
    const req = makeRequest(
      { type: 'verification', toEmail: 'user@example.com', name: 'Test User', actionUrl: 'https://example.com/verify' },
      VALID_SECRET,
    );
    await POST(req);
    const sendArgs = mockSend.mock.calls[0][0];
    expect(sendArgs.from).toBe('onboarding@resend.dev');
  });
});
