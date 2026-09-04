import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'

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

import { useRequireAuth } from '@/lib/hooks/useRequireAuth'

describe('useRequireAuth', () => {
  beforeEach(() => {
    mockReplace.mockClear()
  })

  it('returns user and loading when authenticated', () => {
    const user = { id: 1, email: 'test@example.com', role: 'BUYER' as const, name: 'Test' }
    mockUseAuth.mockReturnValue({ user, loading: false })

    const { result } = renderHook(() => useRequireAuth())

    expect(result.current.user).toBe(user)
    expect(result.current.loading).toBe(false)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects to /login when not authenticated and not loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    renderHook(() => useRequireAuth())

    expect(mockReplace).toHaveBeenCalledWith('/login')
  })

  it('does not redirect while loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })

    renderHook(() => useRequireAuth())

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('returns loading state correctly', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })

    const { result } = renderHook(() => useRequireAuth())

    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('redirects to /dashboard when user role does not match required role', () => {
    const user = { id: 1, email: 'test@example.com', role: 'BUYER' as const, name: 'Test' }
    mockUseAuth.mockReturnValue({ user, loading: false })

    renderHook(() => useRequireAuth('DESIGNER'))

    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('does not redirect when user role matches required role', () => {
    const user = { id: 1, email: 'test@example.com', role: 'BUYER' as const, name: 'Test' }
    mockUseAuth.mockReturnValue({ user, loading: false })

    renderHook(() => useRequireAuth('BUYER'))

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not redirect when no required role is specified and user is authenticated', () => {
    const user = { id: 1, email: 'test@example.com', role: 'DESIGNER' as const, name: 'Test' }
    mockUseAuth.mockReturnValue({ user, loading: false })

    renderHook(() => useRequireAuth())

    expect(mockReplace).not.toHaveBeenCalled()
  })
})
