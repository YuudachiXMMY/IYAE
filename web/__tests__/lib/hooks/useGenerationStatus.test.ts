import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock api module
const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

import { useGenerationStatus } from '@/lib/hooks/useGenerationStatus'

function makeStatus(overrides = {}) {
  return {
    status: 'READY' as const,
    glbUrl: null,
    usdzUrl: null,
    errorMessage: null,
    retryCount: 0,
    ...overrides,
  }
}

describe('useGenerationStatus', () => {
  beforeEach(() => {
    mockApiGet.mockReset()
    mockApiPost.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('does not fetch when productId is null', () => {
    mockApiGet.mockResolvedValue(makeStatus())
    renderHook(() => useGenerationStatus(null))
    expect(mockApiGet).not.toHaveBeenCalled()
  })

  it('does not fetch when enabled is false', () => {
    mockApiGet.mockResolvedValue(makeStatus())
    renderHook(() => useGenerationStatus(42, false))
    expect(mockApiGet).not.toHaveBeenCalled()
  })

  it('fetches status on mount when productId is provided', async () => {
    const statusData = makeStatus({ status: 'READY', glbUrl: '/models/test.glb' })
    mockApiGet.mockResolvedValue(statusData)

    const { result } = renderHook(() => useGenerationStatus(42))

    // Initial state
    expect(result.current.loading).toBe(true)

    // Let the async fetch complete
    await act(async () => {})

    expect(mockApiGet).toHaveBeenCalledWith('/api/designer/products/42/generation-status')
    expect(result.current.status?.status).toBe('READY')
    expect(result.current.status?.glbUrl).toBe('/models/test.glb')
  })

  it('sets status to null on fetch error', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useGenerationStatus(42))

    await act(async () => {})

    expect(result.current.status).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('sets loading false after fetch completes', async () => {
    mockApiGet.mockResolvedValue(makeStatus())

    const { result } = renderHook(() => useGenerationStatus(42))

    await act(async () => {})

    expect(result.current.loading).toBe(false)
  })

  it('sets actionError when retry fails with ApiError', async () => {
    const { ApiError } = await import('@/lib/api')
    mockApiGet.mockResolvedValue(makeStatus({ status: 'FAILED' }))
    mockApiPost.mockRejectedValue(new ApiError('Retry failed', 500))

    const { result } = renderHook(() => useGenerationStatus(42))
    await act(async () => {})

    await act(async () => {
      await result.current.retry()
    })

    expect(result.current.actionError).toBe('Retry failed')
  })

  it('sets fallback actionError when retry fails with non-ApiError', async () => {
    mockApiGet.mockResolvedValue(makeStatus({ status: 'FAILED' }))
    mockApiPost.mockRejectedValue(new Error('unexpected'))

    const { result } = renderHook(() => useGenerationStatus(42))
    await act(async () => {})

    await act(async () => {
      await result.current.retry()
    })

    expect(result.current.actionError).toBe('Retry failed. Please try again.')
  })

  it('clears actionError via clearActionError', async () => {
    const { ApiError } = await import('@/lib/api')
    mockApiGet.mockResolvedValue(makeStatus({ status: 'FAILED' }))
    mockApiPost.mockRejectedValue(new ApiError('Retry failed', 500))

    const { result } = renderHook(() => useGenerationStatus(42))
    await act(async () => {})
    await act(async () => { await result.current.retry() })

    expect(result.current.actionError).toBe('Retry failed')

    act(() => { result.current.clearActionError() })
    expect(result.current.actionError).toBeNull()
  })

  it('calls regenerate endpoint', async () => {
    mockApiGet.mockResolvedValue(makeStatus({ status: 'READY' }))
    mockApiPost.mockResolvedValue({})

    const { result } = renderHook(() => useGenerationStatus(42))
    await act(async () => {})

    await act(async () => { await result.current.regenerate() })

    expect(mockApiPost).toHaveBeenCalledWith('/api/designer/products/42/regenerate')
  })

  it('retry does nothing when productId is null', async () => {
    const { result } = renderHook(() => useGenerationStatus(null))
    await act(async () => { await result.current.retry() })
    expect(mockApiPost).not.toHaveBeenCalled()
  })

  it('regenerate does nothing when productId is null', async () => {
    const { result } = renderHook(() => useGenerationStatus(null))
    await act(async () => { await result.current.regenerate() })
    expect(mockApiPost).not.toHaveBeenCalled()
  })
})
