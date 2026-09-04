import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/lib/hooks/useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300))
    expect(result.current).toBe('initial')
  })

  it('does not update value before delay has elapsed', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 300 } }
    )

    rerender({ value: 'second', delay: 300 })
    vi.advanceTimersByTime(100)

    expect(result.current).toBe('first')
  })

  it('updates value after delay has elapsed', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'first', delay: 300 } }
    )

    rerender({ value: 'second', delay: 300 })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('second')
  })

  it('only reflects the last value when changed rapidly', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'b' })
    vi.advanceTimersByTime(100)
    rerender({ value: 'c' })
    vi.advanceTimersByTime(100)
    rerender({ value: 'd' })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('d')
  })

  it('cleans up timer on unmount without updating state', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'first' } }
    )

    rerender({ value: 'second' })
    unmount()

    // Advance timers after unmount — should not throw
    act(() => {
      vi.advanceTimersByTime(300)
    })

    // Value remains as captured before unmount
    expect(result.current).toBe('first')
  })

  it('uses default delay of 300ms when no delay is provided', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'original' } }
    )

    rerender({ value: 'updated' })
    vi.advanceTimersByTime(299)
    expect(result.current).toBe('original')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('updated')
  })

  it('works with non-string value types', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 200),
      { initialProps: { value: 0 } }
    )

    rerender({ value: 42 })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current).toBe(42)
  })
})
