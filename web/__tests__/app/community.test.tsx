import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { SocialPost } from "@/lib/community-feed";

// Hoisted mocks — vi.mock factories are hoisted above the module body, so the
// fns they close over must be created with vi.hoisted (not plain top-level consts).
const { requests, mockFeed } = vi.hoisted(() => {
  interface Deferred {
    resolve: (body: unknown) => void;
    reject: (err: unknown) => void;
  }
  const requests: Deferred[] = [];
  return {
    requests,
    mockFeed: vi.fn(
      () =>
        new Promise((resolve, reject) => {
          requests.push({ resolve, reject });
        })
    ),
  };
});

const VIEWER = {
  id: 7,
  name: "Jo",
  username: "jo",
  email: "jo@example.com",
  role: "BUYER" as const,
  styleAesthetics: ["Everyday"],
};

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: VIEWER, loading: false }),
}));

vi.mock("@/lib/api", () => ({
  posts: {
    feed: () => mockFeed(),
    like: vi.fn(),
    unlike: vi.fn(),
  },
  follows: { toggle: vi.fn(), remove: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Chrome the feed does not depend on.
vi.mock("@/components/design-system/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/design-system/SectionKicker", () => ({
  SectionKicker: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("@/components/design-system/EditorialHeading", () => ({
  EditorialHeading: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}));
vi.mock("@/components/design-system/AbstractForm", () => ({ AbstractForm: () => null }));
vi.mock("@/components/design-system/FilterPill", () => ({
  FilterPill: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));
vi.mock("@/components/community/PostMedia", () => ({ PostMedia: () => null }));
vi.mock("@/components/PostDetailDialog", () => ({ PostDetailDialog: () => null }));
vi.mock("@/components/profile/CreateFashionPostDialog", () => ({
  CreateFashionPostDialog: () => null,
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import CommunityPage from "@/app/community/page";

const LOCAL_CAPTION = "A LOCAL DEMO LOOK";

function localPost(): SocialPost {
  return {
    id: "community-local-1",
    creatorUsername: "mila",
    creatorName: "Mila",
    image: "",
    caption: LOCAL_CAPTION,
    postedAt: "2026-10-01T00:00:00.000Z",
    type: "outfit_photo",
    tags: [],
    productLinks: [],
    feedViews: ["for-you"],
    likeCount: 3,
    comments: [],
  };
}

/** A `Post` as `GET /api/posts?feed=` returns it. */
function serverPost(id: number, content: string) {
  return {
    id,
    userId: 99,
    username: "remote",
    content,
    mediaUrls: [],
    status: "ACTIVE",
    likeCount: 1,
    commentCount: 0,
    likedByCurrentUser: false,
    createdAt: "2026-10-09T00:00:00.000Z",
    city: null,
    topic: null,
    savedLookId: null,
    productIds: [],
  };
}

async function settle() {
  await act(async () => {});
}

describe("community feed", () => {
  beforeEach(() => {
    requests.length = 0;
    mockFeed.mockClear();
    localStorage.clear();
    // The viewer already has a local demo feed on disk — which is the whole
    // point: it is what the page used to show while the real feed was loading.
    localStorage.setItem(
      "clossette-community-state-7",
      JSON.stringify({ version: 4, followedUsernames: [], posts: [localPost()] })
    );
  });

  // ── Regression ───────────────────────────────────────────────────────────────

  // `feedPosts` was null both while the fetch was in flight AND after it had
  // fallen back to the local layer, and `feedPosts ?? localPosts` could not tell
  // the two apart. So Discover opened on fabricated demo posts — likeable,
  // followable — which were then swapped out from under the user. The
  // "Loading feed…" branch it already had was unreachable for any viewer with a
  // seeded local feed, i.e. everyone.
  it("shows the loading state, not the local demo feed, while the server feed is in flight", async () => {
    render(<CommunityPage />);
    await settle();

    expect(mockFeed).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Loading feed…")).toBeInTheDocument();
    expect(screen.queryByText(LOCAL_CAPTION)).not.toBeInTheDocument();
  });

  it("renders the real feed once it arrives", async () => {
    render(<CommunityPage />);
    await settle();

    await act(async () => {
      requests[0].resolve({
        content: [serverPost(1, "A REAL SERVER LOOK")],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        last: true,
      });
    });

    expect(screen.getByText("A REAL SERVER LOOK")).toBeInTheDocument();
    expect(screen.queryByText(LOCAL_CAPTION)).not.toBeInTheDocument();
    expect(screen.queryByText("Loading feed…")).not.toBeInTheDocument();
  });

  it("still falls back to the local feed when the server feed fails", async () => {
    render(<CommunityPage />);
    await settle();

    await act(async () => {
      requests[0].reject(new Error("offline"));
    });

    expect(screen.getByText(LOCAL_CAPTION)).toBeInTheDocument();
    expect(screen.queryByText("Loading feed…")).not.toBeInTheDocument();
  });

  it("shows the empty state when the server feed is genuinely empty", async () => {
    render(<CommunityPage />);
    await settle();

    await act(async () => {
      requests[0].resolve({
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        last: true,
      });
    });

    expect(screen.getByText("Nothing to discover yet")).toBeInTheDocument();
    expect(screen.queryByText(LOCAL_CAPTION)).not.toBeInTheDocument();
  });

  it("serves the local-only tabs from storage without hitting the server", async () => {
    render(<CommunityPage />);
    await settle();
    expect(mockFeed).toHaveBeenCalledTimes(1);

    await act(async () => {
      screen.getByRole("button", { name: "Saved" }).click();
    });

    expect(mockFeed).toHaveBeenCalledTimes(1);
    expect(screen.getByText("No saved posts yet")).toBeInTheDocument();
  });
});
