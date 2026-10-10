import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider } from '@/lib/auth-context'
import { CartProvider, useCart } from '@/lib/cart-context'
import { StrictMode, type ReactNode } from 'react'

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

  // The three setDemoItems updaters used to call saveDemoItems() — and
  // addDemoItem used to call generateDemoId() — from inside the updater body.
  // An updater must be pure: React invokes it twice under StrictMode and
  // re-invokes it whenever a pending queue is replayed, so a write in there
  // fires more than once per change and can fire for a render React then
  // discards. These pin the properties that follow from moving the write out.
  describe('demo item persistence is a pure-updater mirror', () => {
    const DEMO_KEY = 'clossette_demo_cart_items'

    /** Structural, so it accepts the spy without naming vitest's MockInstance. */
    type SetItemSpy = { mock: { calls: [key: string, value: string][] } }

    function demoWrites(spy: SetItemSpy): string[] {
      return spy.mock.calls
        .filter(([key]) => key === DEMO_KEY)
        .map(([, value]) => value)
    }

    function strictWrapper() {
      return function Wrapper({ children }: { children: ReactNode }) {
        return (
          <StrictMode>
            <AuthProvider>
              <CartProvider>{children}</CartProvider>
            </AuthProvider>
          </StrictMode>
        )
      }
    }

    it('writes nothing on mount, because that state came from storage', async () => {
      localStorage.setItem(DEMO_KEY, JSON.stringify([
        { id: -7, name: 'Already There', price: 12, quantity: 1, imageUrl: null, selectedSize: 'M' },
      ]))
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))
      const setItem = vi.spyOn(Storage.prototype, 'setItem')

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.demoItems).toHaveLength(1))
      expect(demoWrites(setItem)).toEqual([])

      setItem.mockRestore()
    })

    it('writes once per committed change even under StrictMode', async () => {
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: strictWrapper() })
      await waitFor(() => expect(result.current.loading).toBe(false))

      // Spy after mount so this counts the change, not the hydration.
      const setItem = vi.spyOn(Storage.prototype, 'setItem')
      act(() => {
        result.current.addDemoItem({ name: 'Once', price: 49, quantity: 1, imageUrl: null, selectedSize: 'M' })
      })

      // StrictMode double-invokes the updater. The write must still happen once.
      expect(demoWrites(setItem)).toHaveLength(1)
      expect(JSON.parse(demoWrites(setItem)[0])).toHaveLength(1)

      setItem.mockRestore()
    })

    it('persists exactly the list that was committed', async () => {
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        result.current.addDemoItem({ name: 'A', price: 10, quantity: 1, imageUrl: null, selectedSize: 'S' })
      })
      act(() => {
        result.current.addDemoItem({ name: 'B', price: 20, quantity: 2, imageUrl: null, selectedSize: 'L' })
      })

      expect(JSON.parse(localStorage.getItem(DEMO_KEY)!)).toEqual(result.current.demoItems)
    })

    it('gives two items added in the same millisecond distinct ids', async () => {
      // The old id was `-floor(Date.now() + random * 1000)`. Freezing both
      // sources collapses it to a single value for every item in the cart;
      // the id is the React key and what removeDemoItem matches on.
      vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.loading).toBe(false))

      act(() => {
        result.current.addDemoItem({ name: 'First', price: 10, quantity: 1, imageUrl: null, selectedSize: 'S' })
        result.current.addDemoItem({ name: 'Second', price: 20, quantity: 1, imageUrl: null, selectedSize: 'S' })
      })

      const ids = result.current.demoItems.map((i) => i.id)
      expect(ids).toHaveLength(2)
      expect(new Set(ids).size).toBe(2)
    })

    it('assigns an id below every id already in the cart', async () => {
      localStorage.setItem(DEMO_KEY, JSON.stringify([
        { id: -2, name: 'Low', price: 10, quantity: 1, imageUrl: null, selectedSize: 'S' },
        { id: -9, name: 'Lower', price: 10, quantity: 1, imageUrl: null, selectedSize: 'M' },
      ]))
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.demoItems).toHaveLength(2))

      act(() => {
        result.current.addDemoItem({ name: 'Newest', price: 10, quantity: 1, imageUrl: null, selectedSize: 'L' })
      })

      const added = result.current.demoItems.find((i) => i.name === 'Newest')!
      expect(added.id).toBe(-10)
    })

    it('removing a demo item persists the removal', async () => {
      localStorage.setItem(DEMO_KEY, JSON.stringify([
        { id: -3, name: 'Keep', price: 10, quantity: 1, imageUrl: null, selectedSize: 'S' },
        { id: -4, name: 'Drop', price: 10, quantity: 1, imageUrl: null, selectedSize: 'M' },
      ]))
      mockFetch.mockResolvedValue(makeResponse({ message: 'Not Found' }, 404))

      const { result } = renderHook(() => useCart(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.demoItems).toHaveLength(2))

      act(() => {
        result.current.removeDemoItem(-4)
      })

      const stored = JSON.parse(localStorage.getItem(DEMO_KEY)!) as Array<{ id: number }>
      expect(stored.map((i) => i.id)).toEqual([-3])
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
