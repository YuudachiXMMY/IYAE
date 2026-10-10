import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { SocialPost, PersistedCommunityState } from "@/lib/community-feed";

// Hoisted mocks — vi.mock factories are hoisted above the module body, so the
// fns they close over must be created with vi.hoisted (not plain top-level consts).
const { mockApiGet, mockCounts, onUpdateRef, viewer } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockCounts: vi.fn(),
  // The page hands `onUpdate` to PostDetailDialog; the mock below parks it here
  // so a test can fire the exact callback the dialog would.
  onUpdateRef: { current: null as ((post: SocialPost) => void) | null },
  // Mutable so a test can hand the page a *new* user object with identical
  // values, which is what `refreshUser()` does.
  viewer: { current: null as Record<string, unknown> | null },
}));

const VIEWER = {
  id: 7,
  name: "Jo",
  username: "jo",
  email: "jo@example.com",
  role: "BUYER" as const,
  styleAesthetics: ["Everyday"],
};

vi.mock("next/navigation", () => ({
  useParams: () => ({ username: "mila" }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: viewer.current, loading: false }),
}));

vi.mock("@/lib/api", () => ({
  api: { get: (path: string) => mockApiGet(path) },
  follows: { counts: (id: number) => mockCounts(id), toggle: vi.fn(), remove: vi.fn() },
}));

vi.mock("@/components/PostDetailDialog", () => ({
  PostDetailDialog: ({
    post,
    onUpdate,
  }: {
    post: SocialPost;
    onUpdate: (post: SocialPost) => void;
  }) => {
    onUpdateRef.current = onUpdate;
    return <div data-testid="detail-dialog">{post.caption}</div>;
  },
}));

vi.mock("@/components/design-system/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import ProfilePage from "@/app/profile/[username]/page";

const STORAGE_KEY = "clossette-community-state-7";

function milaPost(): SocialPost {
  return {
    id: "community-mila-1",
    creatorUsername: "mila",
    creatorName: "Mila",
    image: "",
    caption: "Linen, three ways",
    postedAt: "2026-10-01T00:00:00.000Z",
    type: "outfit_photo",
    tags: [],
    productLinks: [],
    feedViews: ["for-you"],
    likeCount: 42,
    comments: [],
  };
}

function stored(): PersistedCommunityState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
}

async function settle() {
  await act(async () => {});
}

describe("public profile page", () => {
  beforeEach(() => {
    localStorage.clear();
    onUpdateRef.current = null;
    viewer.current = { ...VIEWER };
    mockApiGet.mockReset();
    mockCounts.mockReset();
    mockApiGet.mockResolvedValue({
      id: 31,
      username: "mila",
      name: "Mila",
      isDesigner: false,
      styleAesthetics: [],
      avatarMode: null,
      avatarPreset: null,
      createdAt: null,
    });
    mockCounts.mockResolvedValue({ followers: 5, following: 2 });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 4, followedUsernames: [], posts: [milaPost()] })
    );
  });

  it("renders the viewer's stored posts for this profile", async () => {
    render(<ProfilePage />);
    await settle();

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  // ── Regression ───────────────────────────────────────────────────────────────

  // The page's `onUpdate` wrote to React state only. `handleToggleFollow` right
  // beside it *did* call `saveCommunityState`, so a like or a comment left from
  // the detail dialog on a profile was the one interaction in the app that
  // vanished on reload — while the same dialog opened from /community persisted
  // it, because that surface mirrors its state through
  // `useCommunityStatePersistence`.
  it("persists a post update made from the detail dialog", async () => {
    render(<ProfilePage />);
    await settle();

    const thumbnail = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("42"))!;
    await act(async () => {
      thumbnail.click();
    });

    expect(screen.getByTestId("detail-dialog")).toBeInTheDocument();

    await act(async () => {
      onUpdateRef.current!({ ...milaPost(), likeCount: 43, likedByCurrentUser: true });
    });

    expect(stored().posts[0].likeCount).toBe(43);
    expect(stored().posts[0].likedByCurrentUser).toBe(true);
  });

  it("persists a follow toggle", async () => {
    render(<ProfilePage />);
    await settle();

    const follow = screen.getByRole("button", { name: "Follow mila" });
    await act(async () => {
      follow.click();
    });

    expect(stored().followedUsernames).toContain("mila");
  });

  // `refreshUser()` always calls `setUser` with a brand-new object, and this page
  // renders SiteHeader, which triggers it from ProfileSettingsDialog's save. A
  // reseed keyed on the user *object* would therefore throw away in-memory state
  // every time the viewer saved their own bio — which is why this page uses the
  // hook's value-signature key rather than re-deriving the reseed by hand.
  it("does not reseed when refreshUser hands over an identical user object", async () => {
    const { rerender } = render(<ProfilePage />);
    await settle();

    const follow = screen.getByRole("button", { name: "Follow mila" });
    await act(async () => {
      follow.click();
    });
    expect(screen.getByRole("button", { name: "Unfollow mila" })).toBeInTheDocument();

    // Storage is wound back to the pre-follow state, so a reseed from disk would
    // be visible as the Follow button reverting.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 4, followedUsernames: [], posts: [milaPost()] })
    );

    viewer.current = { ...VIEWER }; // same values, new reference
    await act(async () => {
      rerender(<ProfilePage />);
    });

    expect(screen.getByRole("button", { name: "Unfollow mila" })).toBeInTheDocument();
  });
});
