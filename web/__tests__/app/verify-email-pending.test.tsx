import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Hoisted mocks — vi.mock factories are hoisted above the module body, so the
// fns they close over must be created with vi.hoisted (not plain top-level consts).
const { mockGet, mockResend, mockToast } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockResend: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

// Mock next/navigation — the page reads only the `email` query param.
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockGet }),
}));

// Mock the API client. ApiError must stay a real class so `instanceof` works.
vi.mock("@/lib/api", () => ({
  auth: { resendVerification: (email: string) => mockResend(email) },
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

// Mock sonner toasts.
vi.mock("sonner", () => ({ toast: mockToast }));

import VerifyEmailPendingPage from "@/app/verify-email/pending/page";

describe("VerifyEmailPendingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue("a@b.com");
    mockResend.mockResolvedValue({ message: "ok" });
  });

  it("shows the email address from the query param", () => {
    render(<VerifyEmailPendingPage />);
    expect(screen.getByText("a@b.com")).toBeInTheDocument();
    expect(screen.getByText(/Check your inbox/i)).toBeInTheDocument();
  });

  it("resends the verification email and toasts on success", async () => {
    render(<VerifyEmailPendingPage />);
    await userEvent.click(screen.getByRole("button", { name: /resend email/i }));

    expect(mockResend).toHaveBeenCalledWith("a@b.com");
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Verification email sent"),
    );
  });

  it("disables the resend button when no email is present", () => {
    mockGet.mockReturnValue(null);
    render(<VerifyEmailPendingPage />);
    expect(screen.getByRole("button", { name: /resend email/i })).toBeDisabled();
    expect(mockResend).not.toHaveBeenCalled();
  });
});
