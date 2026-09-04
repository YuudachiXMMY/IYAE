import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We test the middleware logic directly by importing it with different NODE_ENV values.
// NextResponse is mocked to capture header writes.

const mockHeaders = new Map<string, string>()
const mockNext = vi.fn(() => ({
  headers: {
    set: (key: string, val: string) => mockHeaders.set(key, val),
    get: (key: string) => mockHeaders.get(key),
  },
}))

vi.mock('next/server', () => ({
  NextResponse: {
    next: () => mockNext(),
  },
}))

function makeRequest(pathname: string) {
  return {
    nextUrl: { pathname },
  }
}

describe('middleware', () => {
  beforeEach(() => {
    mockHeaders.clear()
    mockNext.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sets X-Content-Type-Options to nosniff', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    middleware(makeRequest('/') as never)
    expect(mockHeaders.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('sets X-Frame-Options to DENY', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    middleware(makeRequest('/') as never)
    expect(mockHeaders.get('X-Frame-Options')).toBe('DENY')
  })

  it('sets Referrer-Policy', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    middleware(makeRequest('/') as never)
    expect(mockHeaders.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('production CSP does not contain unsafe-eval', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    // Re-import to pick up env change (module is cached, so we test the logic directly)
    const { middleware } = await import('@/middleware')
    middleware(makeRequest('/') as never)
    const csp = mockHeaders.get('Content-Security-Policy') ?? ''
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('production CSP contains wasm-unsafe-eval', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    middleware(makeRequest('/') as never)
    const csp = mockHeaders.get('Content-Security-Policy') ?? ''
    expect(csp).toContain("'wasm-unsafe-eval'")
  })

  it('CSP includes required directives', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    middleware(makeRequest('/products') as never)
    const csp = mockHeaders.get('Content-Security-Policy') ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-src 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })

  it('AR route gets camera=(self) in Permissions-Policy', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    middleware(makeRequest('/outfits/1/ar') as never)
    const policy = mockHeaders.get('Permissions-Policy') ?? ''
    expect(policy).toContain('camera=(self)')
  })

  it('try-on route gets camera=(self) in Permissions-Policy', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    middleware(makeRequest('/try-on') as never)
    const policy = mockHeaders.get('Permissions-Policy') ?? ''
    expect(policy).toContain('camera=(self)')
  })

  it('non-AR route gets camera=() in Permissions-Policy', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    middleware(makeRequest('/dashboard') as never)
    const policy = mockHeaders.get('Permissions-Policy') ?? ''
    expect(policy).toBe('camera=(), microphone=()')
  })

  it('microphone is always disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')

    middleware(makeRequest('/outfits/1/ar') as never)
    expect(mockHeaders.get('Permissions-Policy')).toContain('microphone=()')

    mockHeaders.clear()
    middleware(makeRequest('/chat') as never)
    expect(mockHeaders.get('Permissions-Policy')).toContain('microphone=()')
  })
})
