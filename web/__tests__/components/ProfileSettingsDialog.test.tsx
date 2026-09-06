import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProfileSettingsDialog } from "@/components/profile/ProfileSettingsDialog";

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
