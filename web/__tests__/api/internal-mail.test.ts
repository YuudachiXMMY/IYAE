import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockSend }
  },
}))

import { POST } from '@/app/api/internal/mail/password-reset/route'

const VALID_SECRET = 'test-secret'

function makeRequest(body: unknown, secret?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret !== undefined) {
    headers['x-internal-mail-secret'] = secret
  }
  return new Request('http://localhost/api/internal/mail/password-reset', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/internal/mail/password-reset', () => {
  beforeEach(() => {
    process.env.INTERNAL_MAIL_SECRET = VALID_SECRET
    process.env.RESEND_API_KEY = 'test-resend-key'
    process.env.MAIL_FROM = 'noreply@iyae.ca'
    mockSend.mockResolvedValue({ data: { id: 'test-email-id' }, error: null })
  })

  afterEach(() => {
    delete process.env.INTERNAL_MAIL_SECRET
    delete process.env.RESEND_API_KEY
    delete process.env.MAIL_FROM
    vi.clearAllMocks()
  })

  it('returns 403 when x-internal-mail-secret header is missing', async () => {
    const req = makeRequest({ toEmail: 'user@example.com', name: 'Test', resetUrl: 'https://example.com/reset' })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 403 when x-internal-mail-secret header is wrong', async () => {
    const req = makeRequest(
      { toEmail: 'user@example.com', name: 'Test', resetUrl: 'https://example.com/reset' },
      'wrong-secret'
    )
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 400 when toEmail is missing', async () => {
    const req = makeRequest({ name: 'Test', resetUrl: 'https://example.com/reset' }, VALID_SECRET)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/toEmail/)
  })

  it('returns 200 with success:true on valid request', async () => {
    const req = makeRequest(
      { toEmail: 'user@example.com', name: 'Test User', resetUrl: 'https://example.com/reset?token=abc' },
      VALID_SECRET
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.id).toBe('test-email-id')
  })

  it('returns 502 when Resend SDK returns an error', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'API error', name: 'api_error', statusCode: 500 } })
    const req = makeRequest(
      { toEmail: 'user@example.com', name: 'Test User', resetUrl: 'https://example.com/reset' },
      VALID_SECRET
    )
    const res = await POST(req)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('Failed to send email')
  })
})
