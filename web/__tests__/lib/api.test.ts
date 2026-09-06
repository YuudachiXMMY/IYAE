import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, auth, admin, avatar, sizing, ApiError } from '@/lib/api'
import type { RegisterRequest, UpdateProfileRequest, UserResponse, ProfileVisibility, AvatarMode, SizeRecommendationResponse } from '@/lib/api'

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

  describe('admin', () => {
    it('admin.listProducts appends the status filter', async () => {
      mockFetch.mockResolvedValue(makeResponse([]))

      await admin.listProducts('ARCHIVED')

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/admin/products?status=ARCHIVED')
      expect(init.method).toBe('GET')
    })

    it('admin.listProducts omits the status query when not provided', async () => {
      mockFetch.mockResolvedValue(makeResponse([]))

      await admin.listProducts()

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/admin/products')
    })

    it('admin.setProductStatus PUTs the new status', async () => {
      mockFetch.mockResolvedValue(makeResponse({ id: 1, status: 'ARCHIVED' }))

      await admin.setProductStatus(1, 'ARCHIVED')

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/admin/products/1/status')
      expect(init.method).toBe('PUT')
      expect(JSON.parse(init.body as string)).toEqual({ status: 'ARCHIVED' })
    })

    it('admin.removePost PUTs to the remove endpoint', async () => {
      mockFetch.mockResolvedValue(makeResponse({ id: 5, status: 'PENDING_DELETE' }))

      await admin.removePost(5)

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/admin/posts/5/remove')
      expect(init.method).toBe('PUT')
    })

    it('admin.setPromotionSlot PUTs the slot type', async () => {
      mockFetch.mockResolvedValue(makeResponse({ id: 3, slotType: 'FEATURED' }))

      await admin.setPromotionSlot(3, 'FEATURED')

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/admin/promotions/3/slot')
      expect(init.method).toBe('PUT')
      expect(JSON.parse(init.body as string)).toEqual({ slotType: 'FEATURED' })
    })
  })

  describe('avatar', () => {
    it('avatar.delete calls DELETE /api/avatar', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 204))

      await avatar.delete()

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/avatar')
      expect(init.method).toBe('DELETE')
    })

    it('avatar.getStatus calls GET /api/avatar/status', async () => {
      mockFetch.mockResolvedValue(makeResponse({ status: 'READY', glbUrl: null, errorMessage: null, retryCount: 0 }))

      await avatar.getStatus()

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/avatar/status')
      expect(init.method).toBe('GET')
    })
  })

  describe('sizing', () => {
    it('sizing.getRecommendedSize calls GET the recommended-size URL with the signal', async () => {
      const body: SizeRecommendationResponse = {
        recommendedSize: 'M',
        basis: 'MEASUREMENT_CHART',
        confidence: 0.8,
        availableSizes: ['S', 'M', 'L'],
      }
      mockFetch.mockResolvedValue(makeResponse(body))
      const controller = new AbortController()

      const result = await sizing.getRecommendedSize(42, controller.signal)

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/products/42/recommended-size')
      expect(init.method).toBe('GET')
      expect(init.signal).toBe(controller.signal)
      expect(result).toEqual(body)
    })
  })
})
