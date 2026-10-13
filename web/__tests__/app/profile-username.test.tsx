import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { SocialPost, PersistedCommunityState } from "@/lib/community-feed";

// Hoisted mocks — vi.mock factories are hoisted above the module body, so the
// fns they close over must be created with vi.hoisted (not plain top-level consts).
const {
  mockApiGet,
  mockCounts,
  mockPostsByUser,
  mockFollowToggle,
  mockFollowRemove,
  onUpdateRef,
  onOpenChangeRef,
  routeUsername,
  viewer,
} = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockCounts: vi.fn(),
  // The profile grid is server-sourced now; see the #22 case below.
  mockPostsByUser: vi.fn(),
  mockFollowToggle: vi.fn(),
  mockFollowRemove: vi.fn(),
  // The page hands `onUpdate` to PostDetailDialog; the mock below parks it here
  // so a test can fire the exact callback the dialog would.
  onUpdateRef: { current: null as ((post: SocialPost) => void) | null },
  // Likewise `onOpenChange`, so a test can dismiss the dialog the way the real one does.
  onOpenChangeRef: { current: null as ((open: boolean) => void) | null },
  // Mutable so a test can navigate /profile/mila -> /profile/other. App Router keeps the
  // same component instance across two URLs matching one dynamic segment, which is exactly
  // the condition the follow-pending scoping has to survive.
  routeUsername: { current: "mila" },
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
  useParams: () => ({ username: routeUsername.current }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: viewer.current, loading: false }),
}));

vi.mock("@/lib/api", () => ({
  api: { get: (path: string) => mockApiGet(path) },
  follows: {
    counts: (id: number) => mockCounts(id),
    toggle: (id: number) => mockFollowToggle(id),
    remove: (id: number) => mockFollowRemove(id),
  },
  posts: { byUser: (...args: unknown[]) => mockPostsByUser(...args) },
  ApiError: class ApiError extends Error {},
}));

vi.mock("@/components/PostDetailDialog", () => ({
  PostDetailDialog: ({
    post,
    onUpdate,
    onOpenChange,
  }: {
    post: SocialPost;
    onUpdate: (post: SocialPost) => void;
    onOpenChange: (open: boolean) => void;
  }) => {
    onUpdateRef.current = onUpdate;
    onOpenChangeRef.current = onOpenChange;
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
  // Three flushes, not one. The page's requests are chained: the public-profile fetch has to
  // resolve before `targetUserId` exists, which is what the follower-counts and posts effects
  // key on. A single flush leaves the second round of promises pending — which made an
  // assertion like `queryByText(...)).not.toBeInTheDocument()` pass for the wrong reason,
  // because nothing had rendered yet at all.
  await act(async () => {});
  await act(async () => {});
  await act(async () => {});
}

describe("public profile page", () => {
  beforeEach(() => {
    localStorage.clear();
    onUpdateRef.current = null;
    onOpenChangeRef.current = null;
    routeUsername.current = "mila";
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
    mockPostsByUser.mockReset();
    mockFollowToggle.mockReset();
    mockFollowRemove.mockReset();
    mockPostsByUser.mockResolvedValue({ content: [] });
    mockFollowToggle.mockResolvedValue(undefined);
    mockFollowRemove.mockResolvedValue(undefined);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 4, followedUsernames: [], posts: [milaPost()] })
    );
  });

  // #22: the grid used to be `state.posts.filter(creatorUsername === username)` — the
  // *viewer's* own local community cache, which holds only their seeded demo posts and what
  // they created themselves. In production every other account's profile therefore rendered
  // an empty grid however much they had posted. This case pinned that behaviour; it now pins
  // the fix.
  it("renders the profiled user's posts from the server, not the viewer's local cache", async () => {
    mockPostsByUser.mockResolvedValue({
      content: [
        {
          id: 99,
          userId: 31,
          username: "mila",
          content: "server-sourced caption",
          mediaUrls: [],
          // toSocialPost maps productIds — an absent one throws inside the mapper, which the
          // page's catch would then report as a failed load. Keep the fixture faithful to the
          // PostResponse DTO.
          productIds: [],
          topic: null,
          city: null,
          status: "ACTIVE",
          likeCount: 7,
          commentCount: 0,
          likedByCurrentUser: false,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(<ProfilePage />);
    await settle();

    expect(mockPostsByUser).toHaveBeenCalledWith(31, 0, 30, expect.anything());
    // The server post rendered (its like count is on the thumbnail)...
    expect(screen.getByText("7")).toBeInTheDocument();
    // ...and the viewer's locally-cached post for this username did not.
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });

  it("says so when the posts request fails, instead of showing an empty grid", async () => {
    mockPostsByUser.mockRejectedValue(new Error("network"));

    render(<ProfilePage />);
    await settle();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("No outfits yet")).not.toBeInTheDocument();
  });

  // #21: the follow button only toggled the local-storage mirror, so a follow made here was
  // invisible to the followed user and to every other device — and it feeds the real follower
  // counts shown directly above it, which therefore never moved.
  it("writes a follow through to the server", async () => {
    render(<ProfilePage />);
    await settle();

    const followButton = screen
      .getAllByRole("button")
      .find((b) => /follow/i.test(b.textContent ?? ""));
    expect(followButton).toBeDefined();
    await act(async () => {
      followButton!.click();
    });

    expect(mockFollowToggle).toHaveBeenCalledWith(31);
  });

  // ── Regression ───────────────────────────────────────────────────────────────

  // The page's `onUpdate` wrote to React state only. `handleToggleFollow` right
  // beside it *did* call `saveCommunityState`, so a like or a comment left from
  // the detail dialog on a profile was the one interaction in the app that
  // vanished on reload — while the same dialog opened from /community persisted
  // it, because that surface mirrors its state through
  // `useCommunityStatePersistence`.
  it("persists a post update made from the detail dialog", async () => {
    // The grid is server-sourced (#22), so the thumbnail that opens the dialog comes from the
    // server page. The subject here is still persistence: the update itself is applied to the
    // post held in local state, which is what the viewer's cache has to end up agreeing with.
    mockPostsByUser.mockResolvedValue({
      content: [
        {
          id: 99,
          userId: 31,
          username: "mila",
          content: "Linen, three ways",
          mediaUrls: [],
          // toSocialPost maps productIds — an absent one throws inside the mapper, which the
          // page's catch would then report as a failed load. Keep the fixture faithful to the
          // PostResponse DTO.
          productIds: [],
          topic: null,
          city: null,
          status: "ACTIVE",
          likeCount: 42,
          commentCount: 0,
          likedByCurrentUser: false,
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    });

    render(<ProfilePage />);
    await settle();

    const thumbnail = screen
      .getAllByRole("button")
      // The thumbnail renders the like count, not the caption.
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

  // ── PR #47 review follow-up ──────────────────────────────────────────────────

  // B3. The counts refresh was chained onto the same promise as the mutation, so one
  // `.catch` covered both. A transient failure fetching the *display* counts therefore ran
  // the revert: the button snapped back to "Follow" and the user was told it had failed —
  // while the server had recorded the follow. Reloading would then show them following
  // someone the UI had just claimed it could not follow.
  it("keeps a successful follow when only the counts refresh fails", async () => {
    render(<ProfilePage />);
    await settle();

    // First call is the mount-time counts effect; the refresh after the toggle is the one
    // that fails.
    mockCounts.mockRejectedValueOnce(new Error("counts unavailable"));

    const follow = screen.getByRole("button", { name: "Follow mila" });
    await act(async () => {
      follow.click();
    });
    await settle();

    expect(mockFollowToggle).toHaveBeenCalledWith(31);
    // Not reverted: the follow itself succeeded.
    expect(screen.getByRole("button", { name: "Unfollow mila" })).toBeInTheDocument();
    expect(stored().followedUsernames).toContain("mila");
  });

  // ...and a genuine failure of the mutation must still revert, so the case above is not
  // just "the revert never runs".
  it("reverts when the follow mutation itself fails", async () => {
    mockFollowToggle.mockRejectedValueOnce(new Error("network"));

    render(<ProfilePage />);
    await settle();

    const follow = screen.getByRole("button", { name: "Follow mila" });
    await act(async () => {
      follow.click();
    });
    await settle();

    expect(screen.getByRole("button", { name: "Follow mila" })).toBeInTheDocument();
  });

  // A6. `followPending` was a bare boolean on a page the App Router reuses across
  // /profile/mila -> /profile/other (one dynamic segment, no `key` to force a remount), so
  // an in-flight follow for mila left *other's* button rendered disabled — and permanently
  // so if that request never settled.
  it("does not disable the follow button on a profile navigated to mid-request", async () => {
    // A follow for mila that never settles.
    mockFollowToggle.mockReturnValueOnce(new Promise(() => {}));

    const { rerender } = render(<ProfilePage />);
    await settle();

    await act(async () => {
      screen.getByRole("button", { name: "Follow mila" }).click();
    });
    expect(screen.getByRole("button", { name: "Unfollow mila" })).toBeDisabled();

    // Navigate to a different profile: same component instance, new route param.
    routeUsername.current = "other";
    mockApiGet.mockResolvedValue({
      id: 32,
      username: "other",
      name: "Other",
      isDesigner: false,
      styleAesthetics: [],
      avatarMode: null,
      avatarPreset: null,
      createdAt: null,
    });
    await act(async () => {
      rerender(<ProfilePage />);
    });
    await settle();

    expect(screen.getByRole("button", { name: "Follow other" })).toBeEnabled();
  });

  // B1. The rollback of a failed comment write arrives asynchronously and goes through
  // `onUpdate`. The dialog is rendered as `{selectedPost && <PostDetailDialog/>}`, so an
  // unconditional `setSelectedPost(updated)` re-opened a dialog the user had already
  // dismissed — showing them their comment being silently removed from a post they had
  // navigated away from.
  it("does not re-open a dismissed detail dialog when a late update arrives", async () => {
    mockPostsByUser.mockResolvedValue({
      content: [
        {
          id: 99,
          userId: 31,
          username: "mila",
          content: "Linen, three ways",
          mediaUrls: [],
          productIds: [],
          topic: null,
          city: null,
          status: "ACTIVE",
          likeCount: 42,
          commentCount: 0,
          likedByCurrentUser: false,
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    });

    render(<ProfilePage />);
    await settle();

    const thumbnail = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("42"))!;
    await act(async () => {
      thumbnail.click();
    });
    expect(screen.getByTestId("detail-dialog")).toBeInTheDocument();

    const lateUpdate = onUpdateRef.current!;
    await act(async () => {
      onOpenChangeRef.current!(false);
    });
    expect(screen.queryByTestId("detail-dialog")).not.toBeInTheDocument();

    await act(async () => {
      lateUpdate({ ...milaPost(), likeCount: 41 });
    });

    expect(screen.queryByTestId("detail-dialog")).not.toBeInTheDocument();
    // The update still reached the stores, so the rolled-back comment is not left behind.
    expect(stored().posts[0].likeCount).toBe(41);
  });
});
