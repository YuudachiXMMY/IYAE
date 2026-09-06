import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Capture the AbortSignal handed to avatar.getStatus so the test can assert the
// hook aborts its in-flight status fetch on unmount (M6).
const capturedSignals: (AbortSignal | undefined)[] = []
const mockGetStatus = vi.fn()

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  avatar: {
    getStatus: (signal?: AbortSignal) => {
      capturedSignals.push(signal)
      return mockGetStatus(signal)
    },
    generate: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

import { useAvatarStatus } from '@/lib/hooks/useAvatarStatus'

function makeStatus(overrides = {}) {
  return {
    status: 'READY' as const,
    glbUrl: null,
    errorMessage: null,
    retryCount: 0,
    ...overrides,
  }
}

describe('useAvatarStatus', () => {
  beforeEach(() => {
    capturedSignals.length = 0
    mockGetStatus.mockReset()
  })

  it('passes an AbortSignal to the status fetch and populates status on resolve', async () => {
    mockGetStatus.mockResolvedValue(makeStatus({ status: 'READY' }))
    const { result } = renderHook(() => useAvatarStatus())

    await waitFor(() => expect(result.current.status?.status).toBe('READY'))
    expect(capturedSignals[0]).toBeInstanceOf(AbortSignal)
    expect(capturedSignals[0]?.aborted).toBe(false)
  })

  it('aborts the in-flight fetch on unmount (M6)', async () => {
    // Never-resolving fetch so the request is still in flight at unmount time.
    mockGetStatus.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderHook(() => useAvatarStatus())

    await waitFor(() => expect(capturedSignals.length).toBeGreaterThan(0))
    const signal = capturedSignals[0]
    expect(signal?.aborted).toBe(false)

    act(() => unmount())
    expect(signal?.aborted).toBe(true)
  })

  it('does not clobber state when the fetch rejects with an AbortError', async () => {
    const abortErr =
      typeof DOMException !== 'undefined'
        ? new DOMException('Aborted', 'AbortError')
        : Object.assign(new Error('Aborted'), { name: 'AbortError' })
    mockGetStatus.mockRejectedValue(abortErr)
    const { result } = renderHook(() => useAvatarStatus())

    // The abort branch returns early without setStatus(null); status stays null
    // (its initial value) rather than being actively cleared.
    await waitFor(() => expect(mockGetStatus).toHaveBeenCalled())
    expect(result.current.status).toBeNull()
  })
})
