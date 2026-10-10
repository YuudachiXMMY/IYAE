import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { StrictMode } from "react";

// Hoisted mocks — vi.mock factories are hoisted above the module body, so the
// fns they close over must be created with vi.hoisted (not plain top-level consts).
const { mockPush, mockGetParam, mockPost, mockRefreshUser, mockToast } = vi.hoisted(
  () => ({
    mockPush: vi.fn(),
    mockGetParam: vi.fn(),
    mockPost: vi.fn(),
    mockRefreshUser: vi.fn(),
    mockToast: { success: vi.fn(), error: vi.fn() },
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGetParam }),
}));

// ApiError must stay a real class so the page's `instanceof` branch works.
vi.mock("@/lib/api", () => ({
  api: { post: mockPost },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ refreshUser: mockRefreshUser }),
}));

vi.mock("sonner", () => ({ toast: mockToast }));

import VerifyEmailPage from "@/app/verify-email/page";
import { ApiError } from "@/lib/api";

/** Lets the verify POST and the `await refreshUser()` after it settle. */
async function settle() {
  await act(async () => {});
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetParam.mockReturnValue("token-abc");
    mockPost.mockResolvedValue({});
    mockRefreshUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("verifies the token and redirects to the dashboard after the delay", async () => {
    render(<VerifyEmailPage />);
    await settle();

    expect(mockPost).toHaveBeenCalledWith("/api/auth/verify-email", {
      token: "token-abc",
    });
    expect(screen.getByText("Email verified!")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  // The redirect used to be an uncleared setTimeout. A user who verified and then
  // navigated somewhere else within the 3s window got yanked to /dashboard out of
  // nowhere — the timer outlived the page that scheduled it.
  it("does not redirect once the page has been left", async () => {
    const { unmount } = render(<VerifyEmailPage />);
    await settle();
    expect(screen.getByText("Email verified!")).toBeInTheDocument();

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  // Same hazard, one tick earlier: unmounting while `refreshUser()` is still in
  // flight must not schedule the redirect at all.
  it("does not schedule the redirect when it unmounts mid-refresh", async () => {
    let releaseRefresh: () => void = () => {};
    mockRefreshUser.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseRefresh = resolve;
      }),
    );

    const { unmount } = render(<VerifyEmailPage />);
    await settle();

    unmount();
    await act(async () => {
      releaseRefresh();
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  // StrictMode replays the effect in dev, and the token is single-use: the
  // server nulls it on the first success, so a second POST comes back 400 —
  // and it is the *live* effect instance whose request loses that race. The
  // page then told a user who had just been verified that it had failed.
  it("does not report failure when the effect is replayed against a single-use token", async () => {
    mockPost
      .mockResolvedValueOnce({})
      .mockRejectedValue(new ApiError(400, "Invalid verification token"));

    render(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>,
    );
    await settle();

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Email verified!")).toBeInTheDocument();
    expect(screen.queryByText("Verification failed")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("reports a failed verification and never redirects", async () => {
    mockPost.mockRejectedValue(new ApiError(400, "Token has expired"));
    render(<VerifyEmailPage />);
    await settle();

    expect(screen.getByText("Verification failed")).toBeInTheDocument();
    expect(screen.getByText("Token has expired")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("errors before any request when the token is missing", async () => {
    mockGetParam.mockReturnValue(null);
    render(<VerifyEmailPage />);

    expect(screen.getByText("Verification token is missing.")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
