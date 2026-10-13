import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The payment-off gate is the PR's headline claim on the client side — "checkout refuses instead
// of silently fulfilling free orders" — and it had no test anywhere. The e2e suite cannot cover
// it either: CI brings the stack up with SPRING_PROFILES_ACTIVE=dev, and application-dev.yml sets
// app.payments.stub-checkout-enabled: true, so `checkoutEnabled` is always true there and
// checkout-flow.spec.ts exercises the live Place Order path. These are the only checks that the
// disabled state renders at all.

const { mockPush, mockReload, mockUsePublicConfig, mockUseCart, mockUseAuth, mockUseRequireAuth } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockReload: vi.fn(),
    mockUsePublicConfig: vi.fn(),
    mockUseCart: vi.fn(),
    mockUseAuth: vi.fn(),
    mockUseRequireAuth: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/components/design-system/SiteHeader", () => ({
  SiteHeader: () => null,
}));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));

vi.mock("@/lib/hooks/usePublicConfig", () => ({
  usePublicConfig: () => mockUsePublicConfig(),
}));
vi.mock("@/lib/cart-context", () => ({ useCart: () => mockUseCart() }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/lib/hooks/useRequireAuth", () => ({
  useRequireAuth: () => mockUseRequireAuth(),
}));

import { CheckoutUnavailableNotice } from "@/components/CheckoutUnavailableNotice";
import CartPage from "@/app/cart/page";
import CheckoutPage from "@/app/checkout/page";

const A_CART_ITEM = {
  id: 1,
  productId: 10,
  productName: "Linen Shirt",
  price: 120,
  quantity: 1,
  selectedSize: "M",
  imageUrl: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCart.mockReturnValue({
    serverItems: [A_CART_ITEM],
    demoItems: [],
    totalCount: 1,
    loading: false,
  });
  mockUseAuth.mockReturnValue({ user: { id: 1, email: "buyer@iyae.ca", role: "BUYER" } });
  mockUseRequireAuth.mockReturnValue({
    user: { id: 1, email: "buyer@iyae.ca", role: "BUYER" },
    loading: false,
  });
});

describe("CheckoutUnavailableNotice", () => {
  it("states that checkout is not open, as a status rather than an error", () => {
    render(<CheckoutUnavailableNotice />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(/checkout isn'?t open yet/i);
    // The bag is not lost — saying so is the point of having a notice instead of a dead button.
    expect(notice).toHaveTextContent(/your bag is saved/i);
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("reports an unknown state as an alert with a retry when the flag could not be read", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<CheckoutUnavailableNotice variant="error" onRetry={onRetry} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/couldn'?t check whether checkout is available/i);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the retry affordance when no retry was supplied", () => {
    render(<CheckoutUnavailableNotice variant="error" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });
});

describe("cart page with payment off", () => {
  it("replaces the Checkout button with the notice", () => {
    mockUsePublicConfig.mockReturnValue({
      config: { checkoutEnabled: false, requireEmailVerification: true },
      loading: false,
      error: null,
      reload: mockReload,
    });

    render(<CartPage />);

    expect(screen.getByRole("status")).toHaveTextContent(/checkout isn'?t open yet/i);
    expect(screen.queryByRole("button", { name: /^checkout$/i })).not.toBeInTheDocument();
  });

  it("offers Checkout when payment is on", () => {
    mockUsePublicConfig.mockReturnValue({
      config: { checkoutEnabled: true, requireEmailVerification: true },
      loading: false,
      error: null,
      reload: mockReload,
    });

    render(<CartPage />);

    expect(screen.getByRole("button", { name: /^checkout$/i })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not offer Checkout while the flag is still loading", () => {
    mockUsePublicConfig.mockReturnValue({
      config: null,
      loading: true,
      error: null,
      reload: mockReload,
    });

    render(<CartPage />);

    // The one purchase affordance must not be clickable before we know whether it can succeed.
    expect(screen.getByRole("button", { name: /checking/i })).toBeDisabled();
  });

  it("surfaces a retry when the flag could not be read at all", async () => {
    const user = userEvent.setup();
    mockUsePublicConfig.mockReturnValue({
      config: null,
      loading: false,
      error: new Error("network"),
      reload: mockReload,
    });

    render(<CartPage />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockReload).toHaveBeenCalledOnce();
  });
});

describe("checkout route with payment off", () => {
  it("shows the notice instead of a fulfillment form it could never submit", () => {
    mockUsePublicConfig.mockReturnValue({
      config: { checkoutEnabled: false, requireEmailVerification: true },
      loading: false,
      error: null,
      reload: mockReload,
    });

    render(<CheckoutPage />);

    expect(screen.getByRole("status")).toHaveTextContent(/checkout isn'?t open yet/i);
    expect(screen.queryByRole("button", { name: /place order/i })).not.toBeInTheDocument();
    // The route is directly addressable, so it has to offer a way back rather than a dead end.
    expect(screen.getByRole("link", { name: /back to bag/i })).toHaveAttribute("href", "/cart");
  });

  it("shows the unknown-state alert when the flag could not be read", () => {
    mockUsePublicConfig.mockReturnValue({
      config: null,
      loading: false,
      error: new Error("network"),
      reload: mockReload,
    });

    render(<CheckoutPage />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /place order/i })).not.toBeInTheDocument();
  });
});
