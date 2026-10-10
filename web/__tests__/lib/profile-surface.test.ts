import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// profile-surface uses localStorage and CustomEvent — both available in jsdom

import { useProfileSurface, subscribeToProfileSurface } from '@/lib/profile-surface'
import type { ProfileSurface } from '@/lib/profile-surface'

const defaultSurface: ProfileSurface = {
  username: null,
  displayName: null,
  avatarMode: null,
  avatarPreset: null,
  avatarDataUrl: null,
  bannerDataUrl: null,
  bio: '',
}

describe('useProfileSurface', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns default surface when localStorage is empty', () => {
    const { result } = renderHook(() => useProfileSurface('user-1'))
    expect(result.current.surface).toEqual(defaultSurface)
  })

  it('loads existing surface from localStorage on mount', () => {
    const stored: ProfileSurface = {
      ...defaultSurface,
      username: 'jadyn',
      bio: 'Hello world',
    }
    localStorage.setItem('clossette.profile-surface.user-1', JSON.stringify(stored))

    const { result } = renderHook(() => useProfileSurface('user-1'))

    expect(result.current.surface.username).toBe('jadyn')
    expect(result.current.surface.bio).toBe('Hello world')
  })

  it('updateSurface persists to localStorage', () => {
    const { result } = renderHook(() => useProfileSurface('user-1'))

    act(() => {
      result.current.updateSurface({ bio: 'Updated bio' })
    })

    const stored = JSON.parse(localStorage.getItem('clossette.profile-surface.user-1') ?? '{}')
    expect(stored.bio).toBe('Updated bio')
  })

  it('updateSurface preserves other fields when updating one field', () => {
    const initial: ProfileSurface = { ...defaultSurface, username: 'jadyn', bio: 'original' }
    localStorage.setItem('clossette.profile-surface.user-2', JSON.stringify(initial))

    const { result } = renderHook(() => useProfileSurface('user-2'))

    act(() => {
      result.current.updateSurface({ bio: 'new bio' })
    })

    expect(result.current.surface.username).toBe('jadyn')
    expect(result.current.surface.bio).toBe('new bio')
  })

  it('updateSurface dispatches CustomEvent for cross-tab sync', () => {
    const listener = vi.fn()
    window.addEventListener('clossette:profile-surface-updated:user-3', listener)

    const { result } = renderHook(() => useProfileSurface('user-3'))

    act(() => {
      result.current.updateSurface({ displayName: 'New Name' })
    })

    expect(listener).toHaveBeenCalledTimes(1)
    const event = listener.mock.calls[0][0] as CustomEvent<ProfileSurface>
    expect(event.detail.displayName).toBe('New Name')

    window.removeEventListener('clossette:profile-surface-updated:user-3', listener)
  })

  it('clearSurface resets to defaults and removes localStorage entry', () => {
    localStorage.setItem(
      'clossette.profile-surface.user-4',
      JSON.stringify({ ...defaultSurface, username: 'remove-me' })
    )

    const { result } = renderHook(() => useProfileSurface('user-4'))

    act(() => {
      result.current.clearSurface()
    })

    expect(result.current.surface).toEqual(defaultSurface)
    expect(localStorage.getItem('clossette.profile-surface.user-4')).toBeNull()
  })

  it('updates state when CustomEvent is dispatched externally', () => {
    const { result } = renderHook(() => useProfileSurface('user-5'))

    const updated: ProfileSurface = { ...defaultSurface, bio: 'From other tab' }

    act(() => {
      // Storage first, then the announcement — the order every writer uses.
      localStorage.setItem('clossette.profile-surface.user-5', JSON.stringify(updated))
      window.dispatchEvent(
        new CustomEvent('clossette:profile-surface-updated:user-5', { detail: updated })
      )
    })

    expect(result.current.surface.bio).toBe('From other tab')
  })

  it('uses legacy storage key when no userId provided', () => {
    const { result } = renderHook(() => useProfileSurface())

    act(() => {
      result.current.updateSurface({ bio: 'legacy' })
    })

    const stored = JSON.parse(localStorage.getItem('clossette_profile_surface') ?? '{}')
    expect(stored.bio).toBe('legacy')
  })
})

describe('subscribeToProfileSurface', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('calls callback when CustomEvent is dispatched', () => {
    const callback = vi.fn()
    const unsubscribe = subscribeToProfileSurface('user-sub-1', callback)

    const detail: ProfileSurface = { ...defaultSurface, username: 'subscribed' }
    window.dispatchEvent(
      new CustomEvent('clossette:profile-surface-updated:user-sub-1', { detail })
    )

    expect(callback).toHaveBeenCalledWith(detail)
    unsubscribe()
  })

  it('unsubscribe removes event listener', () => {
    const callback = vi.fn()
    const unsubscribe = subscribeToProfileSurface('user-sub-2', callback)
    unsubscribe()

    window.dispatchEvent(
      new CustomEvent('clossette:profile-surface-updated:user-sub-2', {
        detail: defaultSurface,
      })
    )

    expect(callback).not.toHaveBeenCalled()
  })
})
