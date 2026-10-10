import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { StrictMode } from "react";
import type { Product } from "@/components/ProductListItem";

// Hoisted mocks — vi.mock factories are hoisted above the module body, so the
// fns they close over must be created with vi.hoisted (not plain top-level consts).
const { params, mockPush, mockApiGet } = vi.hoisted(() => ({
  params: { current: new URLSearchParams("page=0") },
  mockPush: vi.fn(),
  mockApiGet: vi.fn(),
}));

// `useSearchParams` is not reactive here: the test sets `params.current` to the
// URL the page would have navigated to and re-renders, which is what Next's
// router does on `router.push`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => params.current,
}));

vi.mock("@/lib/api", () => ({
  api: { get: (path: string, options?: { signal?: AbortSignal }) => mockApiGet(path, options) },
}));

vi.mock("@/lib/saved-products", () => ({
  toggleSavedProduct: vi.fn(),
  useSavedProductIds: () => new Set<number>(),
}));

// Chrome the grid does not depend on. ProductCard is reduced to its name so the
// assertions read as "which pieces are on screen".
vi.mock("@/components/design-system/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/SearchFilterBar", () => ({ SearchFilterBar: () => null }));
vi.mock("@/components/design-system/SectionKicker", () => ({
  SectionKicker: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("@/components/design-system/EditorialHeading", () => ({
  EditorialHeading: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@/components/design-system/ProductCard", () => ({
  ProductCard: ({ name }: { name: string }) => <div>{name}</div>,
}));

import ProductsPage from "@/app/products/page";

interface Deferred {
  path: string;
  signal?: AbortSignal;
  resolve: (page: unknown) => void;
  reject: (err: unknown) => void;
}

/** Every `api.get` the page makes, in order, each settleable on demand. */
let requests: Deferred[] = [];

function product(id: number, name: string): Product {
  return {
    id,
    name,
    description: "",
    price: 100,
    currency: "CAD",
    category: "Clothing",
    styleTags: [],
    colorTags: [],
    sizes: [],
    media: [],
    glbUrl: null,
    status: "ACTIVE",
  };
}

function pageOf(items: Product[], page: number, last: boolean) {
  return {
    content: items,
    page,
    size: 20,
    totalElements: last ? items.length : 40,
    totalPages: last ? 1 : 2,
    last,
  };
}

/** Settle one request and let React flush the resulting render. */
async function settle(request: Deferred, body: unknown) {
  await act(async () => {
    request.resolve(body);
  });
}

function loadMoreButton() {
  return screen.queryByRole("button", { name: /load more|loading/i });
}

describe("ProductsPage request races", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requests = [];
    params.current = new URLSearchParams("page=0");
    mockApiGet.mockImplementation(
      (path: string, options?: { signal?: AbortSignal }) =>
        new Promise((resolve, reject) => {
          requests.push({ path, signal: options?.signal, resolve, reject });
        }),
    );
  });

  it("renders the first page and appends the next one on LOAD MORE", async () => {
    const view = render(<ProductsPage />);
    await settle(requests[0], pageOf([product(1, "Linen Coat")], 0, false));
    expect(screen.getByText("Linen Coat")).toBeInTheDocument();

    // LOAD MORE navigates; the test plays the router's part.
    params.current = new URLSearchParams("page=1");
    view.rerender(<ProductsPage />);
    await settle(requests[1], pageOf([product(2, "Wool Trousers")], 1, true));

    expect(screen.getByText("Linen Coat")).toBeInTheDocument();
    expect(screen.getByText("Wool Trousers")).toBeInTheDocument();
  });

  // The effect had no cleanup, so a page>0 response that lost the race still ran
  // its append branch — dropping rows from the *previous* filter into the new
  // result set.
  it("does not append a page from a filter the user has already left", async () => {
    const view = render(<ProductsPage />);
    await settle(requests[0], pageOf([product(1, "Linen Coat")], 0, false));

    // LOAD MORE for the unfiltered query…
    params.current = new URLSearchParams("page=1");
    view.rerender(<ProductsPage />);
    expect(requests).toHaveLength(2);

    // …then a filter change before that page comes back.
    params.current = new URLSearchParams("page=0&category=Accessories");
    view.rerender(<ProductsPage />);
    expect(requests).toHaveLength(3);

    await settle(requests[2], pageOf([product(9, "Silk Scarf")], 0, true));
    await settle(requests[1], pageOf([product(2, "Wool Trousers")], 1, true));

    expect(screen.getByText("Silk Scarf")).toBeInTheDocument();
    expect(screen.queryByText("Wool Trousers")).not.toBeInTheDocument();
  });

  // Worse than a stale row: the stale run's `finally` wrote its own query into
  // `loadedQuery`, and `loading` is derived as `loadedQuery !== query`. Nothing
  // re-runs the effect afterwards, so LOAD MORE stayed disabled on "LOADING…"
  // for as long as the user stayed on the page.
  it("does not leave LOAD MORE stuck after a stale response lands", async () => {
    const view = render(<ProductsPage />);
    await settle(requests[0], pageOf([product(1, "Linen Coat")], 0, false));

    params.current = new URLSearchParams("page=1");
    view.rerender(<ProductsPage />);

    params.current = new URLSearchParams("page=0&category=Accessories");
    view.rerender(<ProductsPage />);

    await settle(requests[2], pageOf([product(9, "Silk Scarf")], 0, false));
    expect(loadMoreButton()).toHaveTextContent("LOAD MORE");

    await settle(requests[1], pageOf([product(2, "Wool Trousers")], 1, true));
    expect(loadMoreButton()).toHaveTextContent("LOAD MORE");
    expect(loadMoreButton()).not.toBeDisabled();
  });

  // The dev double-mount is the same shape as a filter change mid-request: the
  // replayed effect must leave exactly one live request behind.
  it("leaves one live request when StrictMode replays the effect", async () => {
    render(
      <StrictMode>
        <ProductsPage />
      </StrictMode>,
    );

    expect(requests).toHaveLength(2);
    expect(requests[0].signal?.aborted).toBe(true);
    expect(requests[1].signal?.aborted).toBe(false);

    await settle(requests[1], pageOf([product(1, "Linen Coat")], 0, true));
    expect(screen.getAllByText("Linen Coat")).toHaveLength(1);
  });

  it("aborts the in-flight request when the query changes", async () => {
    const view = render(<ProductsPage />);
    expect(requests[0].signal?.aborted).toBe(false);

    params.current = new URLSearchParams("page=0&category=Accessories");
    view.rerender(<ProductsPage />);

    expect(requests[0].signal?.aborted).toBe(true);
    expect(requests[1].signal?.aborted).toBe(false);
  });

  // An aborted request rejects; that rejection is not a failed search and must
  // not blank the grid the surviving request just filled.
  it("keeps the current grid when a superseded request rejects", async () => {
    const view = render(<ProductsPage />);

    // The first request never comes back before the filter changes…
    params.current = new URLSearchParams("page=0&category=Accessories");
    view.rerender(<ProductsPage />);
    await settle(requests[1], pageOf([product(9, "Silk Scarf")], 0, true));
    expect(screen.getByText("Silk Scarf")).toBeInTheDocument();

    // …and then fails. Its failure says nothing about the search now on screen.
    await act(async () => {
      requests[0].reject(new DOMException("Aborted", "AbortError"));
    });

    expect(screen.getByText("Silk Scarf")).toBeInTheDocument();
    expect(loadMoreButton()).toBeNull(); // last page — nothing more to load
  });
});
