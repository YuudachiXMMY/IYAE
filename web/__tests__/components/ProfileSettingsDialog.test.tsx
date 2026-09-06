import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProfileSettingsDialog } from "@/components/profile/ProfileSettingsDialog";
import { avatar } from "@/lib/api";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    api: {
      get: vi.fn().mockResolvedValue({}),
      post: vi.fn().mockResolvedValue({}),
    },
    auth: { updateProfile: vi.fn().mockResolvedValue({}) },
    avatar: { delete: vi.fn().mockResolvedValue({}) },
    ApiError,
  };
});

const baseProps = {
  user: { id: 1, name: "Jane", email: "jane@example.com", username: "jane" },
  surface: { avatarDataUrl: null, bannerDataUrl: null, bio: "" },
  onUpdateSurface: vi.fn(),
  onUserRefresh: vi.fn(),
};

describe("ProfileSettingsDialog delete-confirm reset", () => {
  it("shows Confirm/Cancel after clicking Delete", async () => {
    render(<ProfileSettingsDialog open onOpenChange={vi.fn()} {...baseProps} />);

    const deleteBtn = await screen.findByRole("button", {
      name: /delete my avatar & body data/i,
    });
    fireEvent.click(deleteBtn);

    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });

  it("returns to the initial (non-confirm) state after close + reopen", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ProfileSettingsDialog open onOpenChange={onOpenChange} {...baseProps} />
    );

    // Enter confirm mode.
    fireEvent.click(
      await screen.findByRole("button", {
        name: /delete my avatar & body data/i,
      })
    );
    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeInTheDocument();

    // Dismiss via Esc/outside-click equivalent (dialog closes), then reopen.
    rerender(
      <ProfileSettingsDialog open={false} onOpenChange={onOpenChange} {...baseProps} />
    );
    rerender(
      <ProfileSettingsDialog open onOpenChange={onOpenChange} {...baseProps} />
    );

    // Confirm state must be cleared: primary button back, no "Confirm delete".
    expect(
      await screen.findByRole("button", {
        name: /delete my avatar & body data/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /confirm delete/i })
    ).not.toBeInTheDocument();
  });
});

describe("ProfileSettingsDialog delete flow (M10/M11)", () => {
  const enterConfirm = async () => {
    fireEvent.click(
      await screen.findByRole("button", { name: /delete my avatar & body data/i })
    );
  };

  it("Cancel returns to the non-confirm state without deleting", async () => {
    vi.mocked(avatar.delete).mockClear();
    render(<ProfileSettingsDialog open onOpenChange={vi.fn()} {...baseProps} />);
    await enterConfirm();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(
      screen.getByRole("button", { name: /delete my avatar & body data/i })
    ).toBeInTheDocument();
    expect(avatar.delete).not.toHaveBeenCalled();
  });

  it("Confirm calls avatar.delete, toasts success, and refreshes the user", async () => {
    vi.mocked(avatar.delete).mockClear();
    vi.mocked(avatar.delete).mockResolvedValueOnce(undefined as never);
    const onUserRefresh = vi.fn();
    render(
      <ProfileSettingsDialog
        open
        onOpenChange={vi.fn()}
        {...baseProps}
        onUserRefresh={onUserRefresh}
      />
    );
    await enterConfirm();

    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() => expect(avatar.delete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(onUserRefresh).toHaveBeenCalled());
  });

  it("shows an error toast and stays usable when the delete fails", async () => {
    vi.mocked(avatar.delete).mockClear();
    vi.mocked(avatar.delete).mockRejectedValueOnce(new Error("network"));
    render(<ProfileSettingsDialog open onOpenChange={vi.fn()} {...baseProps} />);
    await enterConfirm();

    fireEvent.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // Still in confirm mode (not crashed) — Confirm button remains present.
    expect(
      screen.getByRole("button", { name: /confirm delete/i })
    ).toBeInTheDocument();
  });

  it("moves focus to Cancel and marks the region aria-live on entering confirm (M10)", async () => {
    render(<ProfileSettingsDialog open onOpenChange={vi.fn()} {...baseProps} />);
    await enterConfirm();

    const cancelBtn = screen.getByRole("button", { name: /^cancel$/i });
    await waitFor(() => expect(cancelBtn).toHaveFocus());
    expect(cancelBtn.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });
});
