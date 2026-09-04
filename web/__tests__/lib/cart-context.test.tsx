import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider } from '@/lib/auth-context'
import { CartProvider, useCart } from '@/lib/cart-context'
import type { ReactNode } from 'react'

const mockFetch = vi.fn()

const mockUser = {
  id: 1,
  email: 'buyer@example.com',
  name: 'Buyer',
  role: 'BUYER' as const,
  emailVerified: true,
}

const mockCartResponse = {
  id: 1,
  items: [
    { id: 101, productId: 10, productName: 'Test Top', productPrice: 59.99, currency: 'USD', quantity: 1, imageUrl: null, selectedSize: 'M' },
  ],
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

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    )
  }
}

describe('CartContext', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  describe('useCart outside provider', () => {
    it('throws when used outside CartProvider', () => {
      expect(() => {
        renderHook(() => useCart())
      }).toThrow('useCart must be used within a CartProvider')
    })
  })

  describe('demo items (no auth required)', () => {
    it('loads demo items from localStorage on mount', async () => {
      const demoItems = [{ id: -1, name: 'Demo Dress', price: 99, quantity: 1, imageUrl: null, selectedSize: 'M' }]
      localStorage.setItem('clossette_demo_cart_items', JSON.stringify(demoItems))
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.demoItems).toHaveLength(1)
      })
      expect(result.current.demoItems[0].name).toBe('Demo Dress')
      expect(result.current.demoItems[0].selectedSize).toBe('M')
    })

    it('addDemoItem creates item with negative id and persists', async () => {
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        result.current.addDemoItem({ name: 'New Demo', price: 49, quantity: 1, imageUrl: null, selectedSize: 'M' })
      })

      expect(result.current.demoItems).toHaveLength(1)
      expect(result.current.demoItems[0].id).toBeLessThan(0)
      expect(result.current.demoItems[0].name).toBe('New Demo')
      expect(result.current.demoItems[0].selectedSize).toBe('M')

      const stored = JSON.parse(localStorage.getItem('clossette_demo_cart_items')!)
      expect(stored).toHaveLength(1)
    })

    it('removeDemoItem removes item and persists', async () => {
      const demoItems = [{ id: -100, name: 'To Remove', price: 30, quantity: 1, imageUrl: null, selectedSize: 'ONE_SIZE' }]
      localStorage.setItem('clossette_demo_cart_items', JSON.stringify(demoItems))
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.demoItems).toHaveLength(1))

      act(() => {
        result.current.removeDemoItem(-100)
      })

      expect(result.current.demoItems).toHaveLength(0)
      const stored = JSON.parse(localStorage.getItem('clossette_demo_cart_items')!)
      expect(stored).toHaveLength(0)
    })

    it('updateDemoItem with quantity 0 removes the item', async () => {
      const demoItems = [{ id: -200, name: 'Zero Qty', price: 20, quantity: 1, imageUrl: null, selectedSize: 'S' }]
      localStorage.setItem('clossette_demo_cart_items', JSON.stringify(demoItems))
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.demoItems).toHaveLength(1))

      act(() => {
        result.current.updateDemoItem(-200, 0)
      })

      expect(result.current.demoItems).toHaveLength(0)
    })

    it('updateDemoItem updates quantity', async () => {
      const demoItems = [{ id: -300, name: 'Update Me', price: 40, quantity: 1, imageUrl: null, selectedSize: 'L' }]
      localStorage.setItem('clossette_demo_cart_items', JSON.stringify(demoItems))
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.demoItems).toHaveLength(1))

      act(() => {
        result.current.updateDemoItem(-300, 5)
      })

      expect(result.current.demoItems[0].quantity).toBe(5)
    })

    it('demo item loads ONE_SIZE for legacy items without selectedSize', async () => {
      // Legacy localStorage data has no selectedSize field
      const legacyItems = [{ id: -400, name: 'Legacy Item', price: 55, quantity: 1, imageUrl: null }]
      localStorage.setItem('clossette_demo_cart_items', JSON.stringify(legacyItems))
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.demoItems).toHaveLength(1))

      expect(result.current.demoItems[0].selectedSize).toBe('ONE_SIZE')
    })
  })

  describe('totalCount', () => {
    it('includes both server and demo items', async () => {
      localStorage.setItem('clossette_token', 'valid')
      localStorage.setItem('clossette_demo_cart_items', JSON.stringify([
        { id: -1, name: 'Demo', price: 10, quantity: 1, imageUrl: null, selectedSize: 'ONE_SIZE' },
      ]))

      mockFetch
        .mockResolvedValueOnce(makeResponse(mockUser))
        .mockResolvedValueOnce(makeResponse(mockCartResponse))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.serverItems).toHaveLength(1)
      })

      expect(result.current.totalCount).toBe(2)
    })
  })

  describe('server items (authenticated)', () => {
    it('fetches server cart when user is authenticated', async () => {
      localStorage.setItem('clossette_token', 'valid')

      mockFetch
        .mockResolvedValueOnce(makeResponse(mockUser))
        .mockResolvedValueOnce(makeResponse(mockCartResponse))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })

      await waitFor(() => {
        expect(result.current.serverItems).toHaveLength(1)
      })

      expect(result.current.serverItems[0].name).toBe('Test Top')
      expect(result.current.serverItems[0].selectedSize).toBe('M')
    })

    it('handles 404 gracefully when no cart exists', async () => {
      localStorage.setItem('clossette_token', 'valid')

      mockFetch
        .mockResolvedValueOnce(makeResponse(mockUser))
        .mockResolvedValueOnce(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.loading).toBe(false))

      expect(result.current.serverItems).toHaveLength(0)
    })
  })
})
