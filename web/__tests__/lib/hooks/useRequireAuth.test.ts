import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'

// Mock next/navigation
const mockReplace = vi.fn()
// The router object is hoisted rather than built inside the factory. `useRouter()` returns a
// stable reference in real Next, and a mock that handed back a fresh object every render made
// `router` an unstable effect dependency all by itself — which masked effect churn coming from
// anywhere else in the hook (the referential-stability case below cannot see its own subject
// otherwise: it measured 3 redirects for 3 renders either way).
const mockRouter = { replace: mockReplace }
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Mock auth-context
const mockUseAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

import { useRequireAuth } from '@/lib/hooks/useRequireAuth'
import { CATALOG_MANAGER_ROLES } from '@/lib/roles'

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

  // ---- B-11: a role *set*, because the catalogue surfaces admit DESIGNER and ADMIN ----
  //
  // The cases above pin strict equality for a single role and still do. These pin that passing
  // the set admits either member. Before this the hook took one role string and compared with
  // `!==`, so ADMIN hitting `useRequireAuth("DESIGNER")` was bounced to /dashboard — which is
  // what made `app/dashboard`'s own "Designer Studio" link (already `DESIGNER || ADMIN`) a dead
  // link in the operator's sidebar.

  it('does not redirect an ADMIN when the catalogue role set is required', () => {
    const user = { id: 1, email: 'ops@iyae.ca', role: 'ADMIN' as const, name: 'Ops' }
    mockUseAuth.mockReturnValue({ user, loading: false })

    renderHook(() => useRequireAuth(CATALOG_MANAGER_ROLES))

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not redirect a DESIGNER when the catalogue role set is required', () => {
    const user = { id: 1, email: 'luna@iyae.ca', role: 'DESIGNER' as const, name: 'Luna' }
    mockUseAuth.mockReturnValue({ user, loading: false })

    renderHook(() => useRequireAuth(CATALOG_MANAGER_ROLES))

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects a BUYER when the catalogue role set is required', () => {
    // The widening must not become "anyone signed in".
    const user = { id: 1, email: 'emma@iyae.ca', role: 'BUYER' as const, name: 'Emma' }
    mockUseAuth.mockReturnValue({ user, loading: false })

    renderHook(() => useRequireAuth(CATALOG_MANAGER_ROLES))

    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('still redirects an ADMIN when a single role of DESIGNER is required', () => {
    // A lone role argument means exactly that role — no implicit hierarchy was introduced.
    const user = { id: 1, email: 'ops@iyae.ca', role: 'ADMIN' as const, name: 'Ops' }
    mockUseAuth.mockReturnValue({ user, loading: false })

    renderHook(() => useRequireAuth('DESIGNER'))

    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('does not re-run the redirect when the caller passes a fresh array each render', () => {
    // Found by the react-reviewer pass. `requiredRole` used to sit in the effect's dependency
    // array directly, so an inline `useRequireAuth(["DESIGNER", "ADMIN"])` — a new array every
    // render — re-ran the effect on every unrelated re-render of the owning component and
    // re-issued router.replace while the first redirect was still in flight. The hook now
    // collapses the argument to a primitive key before depending on it. `exhaustive-deps`
    // cannot catch this class of bug, so it has to be pinned here.
    const user = { id: 1, email: 'emma@iyae.ca', role: 'BUYER' as const, name: 'Emma' }
    mockUseAuth.mockReturnValue({ user, loading: false })

    const { rerender } = renderHook(() => useRequireAuth(['DESIGNER', 'ADMIN']))
    expect(mockReplace).toHaveBeenCalledTimes(1)

    rerender()
    rerender()

    expect(mockReplace).toHaveBeenCalledTimes(1)
  })

  it('redirects an unauthenticated visitor to /login rather than /dashboard for a role set', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    renderHook(() => useRequireAuth(CATALOG_MANAGER_ROLES))

    expect(mockReplace).toHaveBeenCalledWith('/login')
    expect(mockReplace).not.toHaveBeenCalledWith('/dashboard')
  })
})
