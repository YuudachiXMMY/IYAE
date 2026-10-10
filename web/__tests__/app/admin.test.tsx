import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Hoisted mocks — vi.mock factories are hoisted above the module body, so the
// fns they close over must be created with vi.hoisted (not plain top-level consts).
const {
  requests,
  mockListProducts,
  mockListPosts,
  mockListPromotions,
  mockListReports,
} = vi.hoisted(() => {
  interface Deferred {
    label: string;
    arg: unknown;
    signal?: AbortSignal;
    resolve: (body: unknown) => void;
    reject: (err: unknown) => void;
  }
  const requests: Deferred[] = [];
  const park = (label: string) => (arg: unknown, signal?: AbortSignal) =>
    new Promise((resolve, reject) => {
      requests.push({ label, arg, signal, resolve, reject });
    });
  return {
    requests,
    mockListProducts: vi.fn(park("products")),
    mockListPosts: vi.fn(park("posts")),
    mockListPromotions: vi.fn(park("promotions")),
    mockListReports: vi.fn(park("reports")),
  };
});

vi.mock("@/lib/api", () => ({
  admin: {
    listProducts: (status?: string, signal?: AbortSignal) =>
      mockListProducts(status, signal),
    listPosts: (status?: string, signal?: AbortSignal) => mockListPosts(status, signal),
    listPromotions: (signal?: AbortSignal) => mockListPromotions(undefined, signal),
    setProductStatus: vi.fn(),
    archivePost: vi.fn(),
    removePost: vi.fn(),
    setPromotionSlot: vi.fn(),
  },
  adminReports: {
    list: (status?: string, page?: number, size?: number, signal?: AbortSignal) =>
      mockListReports(status, signal),
    resolve: vi.fn(),
    removeComment: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/hooks/useRequireAuth", () => ({
  useRequireAuth: () => ({
    user: { id: 1, role: "ADMIN", email: "a@b.c" },
    loading: false,
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/design-system/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Radix only mounts the active tab panel; flattening it puts all four moderation
// sections on screen at once, which is what this file is actually about.
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import AdminPage from "@/app/admin/page";

function find(label: string, nth = 0) {
  return requests.filter((r) => r.label === label)[nth];
}

async function settle() {
  await act(async () => {});
}

function product(id: number, name: string) {
  return {
    id,
    name,
    price: 120,
    currency: "CAD",
    status: "PUBLISHED",
    designerDisplayName: "Atelier",
    designerLocal: false,
  };
}

describe("admin moderation", () => {
  beforeEach(() => {
    requests.length = 0;
    mockListProducts.mockClear();
    mockListPosts.mockClear();
    mockListPromotions.mockClear();
    mockListReports.mockClear();
  });

  it("loads every section's list on mount", async () => {
    render(<AdminPage />);
    await settle();

    expect(mockListProducts).toHaveBeenCalledTimes(1);
    expect(mockListPosts).toHaveBeenCalledTimes(1);
    expect(mockListPromotions).toHaveBeenCalledTimes(1);
    expect(mockListReports).toHaveBeenCalledTimes(1);
  });

  it("renders the loaded catalog", async () => {
    render(<AdminPage />);
    await settle();

    await act(async () => {
      find("products").resolve([product(1, "Linen Overshirt")]);
    });

    expect(screen.getByText("Linen Overshirt")).toBeInTheDocument();
    expect(screen.queryByText("No products.")).not.toBeInTheDocument();
  });

  // ── Regressions ──────────────────────────────────────────────────────────────

  // A moderation console that renders an outage as "nothing to moderate" is the
  // worst possible failure mode: the admin concludes the queue is clear.
  it.each([
    ["products", "No products."],
    ["posts", "No posts."],
    ["promotions", "No promotions."],
    ["reports", "No reports."],
  ])(
    "says the %s list failed instead of showing it as empty",
    async (label, emptyCopy) => {
      render(<AdminPage />);
      await settle();

      await act(async () => {
        find(label).reject(new Error("Network down"));
      });

      expect(screen.queryByText(emptyCopy)).not.toBeInTheDocument();
      expect(screen.getAllByText(/couldn.t load/i).length).toBeGreaterThan(0);
    }
  );

  it("offers a retry that reloads the failed list", async () => {
    render(<AdminPage />);
    await settle();

    await act(async () => {
      find("products").reject(new Error("Network down"));
    });
    expect(mockListProducts).toHaveBeenCalledTimes(1);

    const retry = screen.getAllByRole("button", { name: /try again/i })[0];
    await act(async () => {
      retry.click();
    });

    expect(mockListProducts).toHaveBeenCalledTimes(2);

    await act(async () => {
      find("products", 1).resolve([product(2, "Wool Trouser")]);
    });

    expect(screen.getByText("Wool Trouser")).toBeInTheDocument();
    expect(screen.queryByText(/couldn.t load/i)).not.toBeInTheDocument();
  });

  it("aborts the in-flight list request when the tab changes", async () => {
    render(<AdminPage />);
    await settle();

    const first = find("products");
    const published = screen.getAllByRole("button", { name: "Published" })[0];
    await act(async () => {
      published.click();
    });

    expect(first.signal?.aborted).toBe(true);
  });

  it("does not strand the catalog on Loading… when a stale tab answers last", async () => {
    render(<AdminPage />);
    await settle();

    // Settle the other three sections so the only "Loading…" left on screen can
    // be the catalog's.
    await act(async () => {
      find("posts").resolve([]);
      find("promotions").resolve([]);
      find("reports").resolve({ content: [] });
    });

    // Leave the "ALL" request in flight, switch tab, let the new one answer first.
    const published = screen.getAllByRole("button", { name: "Published" })[0];
    await act(async () => {
      published.click();
    });

    await act(async () => {
      find("products", 1).resolve([product(3, "Published Only")]);
    });
    // Now the superseded "ALL" request comes back.
    await act(async () => {
      find("products", 0).resolve([product(4, "Everything")]);
    });

    expect(screen.getByText("Published Only")).toBeInTheDocument();
    expect(screen.queryByText("Everything")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });
});
