import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import type { ReactNode } from 'react'

const mockFetch = vi.fn()

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

function makeResponse(body: unknown, status = 200) {
  const bodyStr = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(bodyStr),
  } as Response
}

const mockUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  role: 'BUYER' as const,
  emailVerified: true,
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  describe('useAuth outside provider', () => {
    it('throws when used outside AuthProvider', () => {
      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')
    })
  })

  describe('initial state', () => {
    it('resolves to loading=false, user=null when no token', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
      expect(result.current.user).toBeNull()
    })

    it('hydrates user from token on mount', async () => {
      localStorage.setItem('clossette_token', 'valid-token')
      mockFetch.mockResolvedValue(makeResponse(mockUser))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toEqual(mockUser)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/me',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('clears token when hydration fails', async () => {
      localStorage.setItem('clossette_token', 'expired-token')
      mockFetch.mockResolvedValue(makeResponse({ message: 'Unauthorized' }, 401))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(localStorage.getItem('clossette_token')).toBeNull()
    })
  })

  describe('login', () => {
    it('stores token and sets user on success', async () => {
      const loginResponse = { token: 'new-jwt', user: mockUser }
      mockFetch.mockResolvedValue(makeResponse(loginResponse))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.login('test@example.com', 'password123')
      })

      expect(result.current.user).toEqual(mockUser)
      expect(localStorage.getItem('clossette_token')).toBe('new-jwt')
    })

    it('throws on invalid credentials', async () => {
      mockFetch.mockResolvedValue(makeResponse({ message: 'Invalid email or password' }, 400))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false))

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'wrong')
        }),
      ).rejects.toThrow()
    })
  })

  describe('register', () => {
    it('stores token and sets user on success', async () => {
      const registerResponse = { token: 'reg-jwt', user: { ...mockUser, id: 2, email: 'new@example.com' } }
      mockFetch.mockResolvedValue(makeResponse(registerResponse))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.register({ email: 'new@example.com', password: 'password123', role: 'BUYER', name: 'New User' })
      })

      expect(result.current.user?.email).toBe('new@example.com')
      expect(localStorage.getItem('clossette_token')).toBe('reg-jwt')
    })

    it('stores token and sets user with full profile data', async () => {
      const fullUser = { ...mockUser, id: 3, email: 'full@example.com', styleAesthetics: ['Minimalist', 'Vintage'], budgetRange: '$50-$100' }
      const registerResponse = { token: 'full-jwt', user: fullUser }
      mockFetch.mockResolvedValue(makeResponse(registerResponse))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false))

      await act(async () => {
        await result.current.register({
          email: 'full@example.com',
          password: 'password123',
          role: 'BUYER',
          styleAesthetics: ['Minimalist', 'Vintage'],
          budgetRange: '$50-$100',
        })
      })

      expect(result.current.user?.email).toBe('full@example.com')
      expect(localStorage.getItem('clossette_token')).toBe('full-jwt')
    })
  })

  describe('updateProfile', () => {
    it('updates user state on success', async () => {
      localStorage.setItem('clossette_token', 'valid-token')
      mockFetch.mockResolvedValue(makeResponse(mockUser))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.user).not.toBeNull())

      const updatedUser = { ...mockUser, budgetRange: '$100-$200', styleAesthetics: ['Classic'] }
      mockFetch.mockResolvedValue(makeResponse(updatedUser))

      await act(async () => {
        await result.current.updateProfile({ budgetRange: '$100-$200', styleAesthetics: ['Classic'] })
      })

      expect(result.current.user).toMatchObject({ budgetRange: '$100-$200', styleAesthetics: ['Classic'] })
    })
  })

  describe('logout', () => {
    it('clears user, token, and demo cart items', async () => {
      localStorage.setItem('clossette_token', 'valid-token')
      localStorage.setItem('clossette_demo_cart_items', '[{"id":-1}]')
      mockFetch.mockResolvedValue(makeResponse(mockUser))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.user).not.toBeNull())

      act(() => {
        result.current.logout()
      })

      expect(result.current.user).toBeNull()
      expect(localStorage.getItem('clossette_token')).toBeNull()
      expect(localStorage.getItem('clossette_demo_cart_items')).toBeNull()
    })
  })

  describe('refreshUser', () => {
    it('updates user data from /api/auth/me', async () => {
      localStorage.setItem('clossette_token', 'valid-token')
      mockFetch.mockResolvedValue(makeResponse(mockUser))

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.user).not.toBeNull())

      const updatedUser = { ...mockUser, name: 'Updated Name' }
      mockFetch.mockResolvedValue(makeResponse(updatedUser))

      await act(async () => {
        await result.current.refreshUser()
      })

      expect(result.current.user?.name).toBe('Updated Name')
    })

    it('does nothing when no token exists', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false))

      mockFetch.mockClear()

      await act(async () => {
        await result.current.refreshUser()
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
