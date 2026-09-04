import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, auth, ApiError } from '@/lib/api'
import type { RegisterRequest, UpdateProfileRequest, UserResponse, ProfileVisibility, AvatarMode } from '@/lib/api'

describe('api', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  function makeResponse(body: unknown, status = 200) {
    const bodyStr = JSON.stringify(body);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(bodyStr),
    } as Response
  }

  describe('api.get', () => {
    it('calls fetch with GET method and correct URL', async () => {
      mockFetch.mockResolvedValue(makeResponse({ id: 1 }))

      const result = await api.get<{ id: number }>('/api/test')

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/test')
      expect(init.method).toBe('GET')
      expect(result).toEqual({ id: 1 })
    })

    it('injects Authorization header when token is in localStorage', async () => {
      localStorage.setItem('clossette_token', 'fake-token')
      mockFetch.mockResolvedValue(makeResponse({ ok: true }))

      await api.get('/api/test')

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer fake-token')
    })

    it('does not inject Authorization header when no token', async () => {
      mockFetch.mockResolvedValue(makeResponse({ ok: true }))

      await api.get('/api/test')

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined()
    })
  })

  describe('api.post', () => {
    it('calls fetch with POST method and serialized body', async () => {
      mockFetch.mockResolvedValue(makeResponse({ created: true }))

      await api.post('/api/items', { name: 'Test' })

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/items')
      expect(init.method).toBe('POST')
      expect(init.body).toBe(JSON.stringify({ name: 'Test' }))
    })
  })

  describe('api.put', () => {
    it('calls fetch with PUT method', async () => {
      mockFetch.mockResolvedValue(makeResponse({ updated: true }))

      await api.put('/api/items/1', { name: 'Updated' })

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(init.method).toBe('PUT')
    })
  })

  describe('api.delete', () => {
    it('calls fetch with DELETE method', async () => {
      mockFetch.mockResolvedValue(makeResponse({ deleted: true }))

      await api.delete('/api/items/1')

      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(init.method).toBe('DELETE')
    })
  })

  describe('error handling', () => {
    it('throws ApiError with status and message on non-ok response', async () => {
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      await expect(api.get('/api/missing')).rejects.toThrow(ApiError)
      await expect(api.get('/api/missing')).rejects.toMatchObject({
        status: 404,
        message: 'Not Found',
      })
    })

    it('throws ApiError with fallback message when response body has no message', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 500))

      await expect(api.get('/api/error')).rejects.toMatchObject({
        status: 500,
        message: 'HTTP 500',
      })
    })
  })

  describe('auth', () => {
    it('auth.register calls POST /api/auth/register with RegisterRequest object', async () => {
      const mockResponse = { token: 'jwt-token', user: { id: 1, email: 'new@example.com', name: 'New', role: 'BUYER', emailVerified: false } }
      mockFetch.mockResolvedValue(makeResponse(mockResponse))

      const data: RegisterRequest = { email: 'new@example.com', password: 'password123', role: 'BUYER', name: 'New', styleAesthetics: ['Minimalist'] }
      const result = await auth.register(data)

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/auth/register')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body as string)).toMatchObject({ email: 'new@example.com', role: 'BUYER' })
      expect(result).toEqual(mockResponse)
    })

    it('auth.updateProfile calls PUT /api/auth/me with UpdateProfileRequest', async () => {
      const mockUser: UserResponse = { id: 1, email: 'user@example.com', name: 'User', role: 'BUYER', emailVerified: true, budgetRange: '$50-$100' }
      mockFetch.mockResolvedValue(makeResponse(mockUser))

      const data: UpdateProfileRequest = { budgetRange: '$50-$100', styleAesthetics: ['Vintage'] }
      const result = await auth.updateProfile(data)

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/auth/me')
      expect(init.method).toBe('PUT')
      expect(result).toEqual(mockUser)
    })

    it('auth.me calls GET /api/auth/me', async () => {
      const mockUser: UserResponse = { id: 1, email: 'user@example.com', name: 'User', role: 'BUYER', emailVerified: true }
      mockFetch.mockResolvedValue(makeResponse(mockUser))

      await auth.me()

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/auth/me')
      expect(init.method).toBe('GET')
    })

    it('exported types are structurally correct', () => {
      const visibility: ProfileVisibility = 'PUBLIC'
      const mode: AvatarMode = 'AI_AVATAR'
      expect(visibility).toBe('PUBLIC')
      expect(mode).toBe('AI_AVATAR')
    })
  })
})
