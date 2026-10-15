import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

/**
 * B-11. `/designer/products` is the one designer route that does not use `useRequireAuth` — it
 * hand-rolls two `role !== "DESIGNER"` checks, one gating the product fetch and one rendering an
 * in-place "Designer area" dead end instead of redirecting. Both had to move to
 * `canManageCatalog` separately, and the fetch guard is the easier one to miss: an ADMIN that
 * passed the render gate but not the fetch gate would have seen a permanently empty studio with
 * no error, which reads as "you have no products" rather than as a bug.
 */

const mockReplace = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}))

const mockUseAuth = vi.fn()
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockGet = vi.fn()
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    delete: vi.fn(),
  },
}))

vi.mock('@/components/design-system/SiteHeader', () => ({
  SiteHeader: () => null,
}))

import DesignerProductsPage from '@/app/designer/products/page'

const aProduct = {
  id: 1,
  name: 'Linen Shirt',
  price: 59.99,
  currency: 'CAD',
  category: 'Tops',
  status: 'PUBLISHED',
  imageUrls: [],
  sizes: ['S', 'M'],
}

describe('/designer/products role gate', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    mockPush.mockClear()
    mockGet.mockReset()
    mockGet.mockResolvedValue([aProduct])
  })

  it('fetches and lists the operator ADMIN own products', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'ops@iyae.ca', role: 'ADMIN', name: 'Ops' },
      loading: false,
    })

    render(<DesignerProductsPage />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/designer/products'))
    expect(await screen.findByText('Linen Shirt')).toBeInTheDocument()
    expect(screen.queryByText('Designer area')).not.toBeInTheDocument()
  })

  it('still fetches for a DESIGNER', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, email: 'luna@iyae.ca', role: 'DESIGNER', name: 'Luna' },
      loading: false,
    })

    render(<DesignerProductsPage />)

    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/designer/products'))
  })

  it('shows a BUYER the Designer area dead end and never fetches', async () => {
    // The in-place gate, not a redirect — e2e/designer-crud.spec.ts pins this string for a
    // shopper, so the widening must not have turned it into "anyone signed in".
    mockUseAuth.mockReturnValue({
      user: { id: 3, email: 'emma@iyae.ca', role: 'BUYER', name: 'Emma' },
      loading: false,
    })

    render(<DesignerProductsPage />)

    expect(await screen.findByText('Designer area')).toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects an unauthenticated visitor to /login', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })

    render(<DesignerProductsPage />)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'))
    expect(mockGet).not.toHaveBeenCalled()
  })
})
