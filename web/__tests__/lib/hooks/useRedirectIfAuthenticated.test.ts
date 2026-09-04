import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock next/navigation
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

// Mock auth-context
const mockUseAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

import { useRedirectIfAuthenticated } from '@/lib/hooks/useRedirectIfAuthenticated'

describe('useRedirectIfAuthenticated', () => {
  beforeEach(() => {
    mockReplace.mockClear()
  })

  it('redirects to /dashboard when user is authenticated', () => {
    const user = { id: 1, email: 'test@example.com', role: 'BUYER' as const, name: 'Test' }
    mockUseAuth.mockReturnValue({ user, loading: false })

    const { result } = renderHook(() => useRedirectIfAuthenticated())

    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('redirects to custom path when specified', () => {
    const user = { id: 1, email: 'test@example.com', role: 'BUYER' as const, name: 'Test' }
    mockUseAuth.mockReturnValue({ user, loading: false })

    renderHook(() => useRedirectIfAuthenticated('/profile'))

    expect(mockReplace).toHaveBeenCalledWith('/profile')
  })

  it('does not redirect when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    const { result } = renderHook(() => useRedirectIfAuthenticated())

    expect(mockReplace).not.toHaveBeenCalled()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('does not redirect while loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })

    const { result } = renderHook(() => useRedirectIfAuthenticated())

    expect(mockReplace).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
  })

  it('returns loading state correctly', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })

    const { result } = renderHook(() => useRedirectIfAuthenticated())

    expect(result.current.loading).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('does not redirect authenticated user while still loading', () => {
    const user = { id: 1, email: 'test@example.com', role: 'BUYER' as const, name: 'Test' }
    mockUseAuth.mockReturnValue({ user, loading: true })

    renderHook(() => useRedirectIfAuthenticated())

    expect(mockReplace).not.toHaveBeenCalled()
  })
})
