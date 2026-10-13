import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import type { SocialPost } from "@/lib/community-feed";

const { mockComment, mockListComments, mockToastError } = vi.hoisted(() => ({
  mockComment: vi.fn(),
  mockListComments: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  posts: {
    comment: (...args: unknown[]) => mockComment(...args),
    listComments: (...args: unknown[]) => mockListComments(...args),
    report: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError, success: vi.fn() },
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

// The dialog renders through Radix; a portal-free passthrough keeps the assertions about
// the handler logic rather than about Radix's own mounting.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/community/PostMedia", () => ({ PostMedia: () => null }));

import { PostDetailDialog } from "@/components/PostDetailDialog";

/**
 * A post backed by the server, carrying one comment that was authored in this session and so
 * has a purely local id — no `srv-c-` prefix, because the server has not assigned one.
 */
function postWithLocalComment(): SocialPost {
  return {
    id: "community-1",
    serverId: 10,
    creatorUsername: "mila",
    creatorName: "Mila",
    image: "",
    caption: "Linen, three ways",
    postedAt: "2026-10-01T00:00:00.000Z",
    type: "outfit_photo",
    tags: [],
    productLinks: [],
    feedViews: ["for-you"],
    likeCount: 0,
    comments: [
      {
        id: "local-comment-1",
        authorName: "You",
        authorHandle: "you",
        copy: "Mine, just now",
        createdLabel: "now",
        replies: [],
      },
    ],
  } as SocialPost;
}

function renderDialog(post: SocialPost, onUpdate = vi.fn()) {
  render(
    <PostDetailDialog
      post={post}
      open
      onOpenChange={vi.fn()}
      onUpdate={onUpdate}
      currentUserName="You"
      currentUserHandle="you"
    />
  );
  return onUpdate;
}

function clickByText(pattern: RegExp) {
  const el = screen
    .getAllByRole("button")
    .find((b) => pattern.test(b.textContent ?? ""));
  expect(el, `no button matching ${pattern}`).toBeDefined();
  return el!;
}

describe("PostDetailDialog replies", () => {
  beforeEach(() => {
    mockComment.mockReset();
    mockListComments.mockReset();
    mockToastError.mockReset();
    mockComment.mockResolvedValue({ id: 1 });
    mockListComments.mockResolvedValue([]);
  });

  // A5. `parentCommentId` is derived from the local comment id, which only carries a server
  // id once the server has assigned one. For a comment authored in this session the id has
  // no `srv-c-` prefix, so `parentCommentId` came out `undefined` — and
  // `POST /api/posts/{id}/comments` with no parent creates a new TOP-LEVEL comment. The
  // thread was silently flattened server-side, visible only after a reload, with nothing
  // reported to the user.
  it("refuses to persist a reply whose parent has no server id yet", async () => {
    const post = postWithLocalComment();
    const onUpdate = renderDialog(post);
    await act(async () => {});

    await act(async () => {
      clickByText(/^reply$/i).click();
    });

    const textarea = screen
      .getAllByRole("textbox")
      .find((t) => /reply/i.test(t.getAttribute("placeholder") ?? ""))!;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "Thanks!" } });
    });

    await act(async () => {
      clickByText(/^post$/i).click();
    });

    // Not written to the wrong place...
    expect(mockComment).not.toHaveBeenCalled();
    // ...and not silently dropped either.
    expect(mockToastError).toHaveBeenCalled();
    // No optimistic reply was committed, so there is nothing stale on screen to roll back.
    expect(onUpdate).not.toHaveBeenCalled();
  });

  // The counterpart: a parent that DOES carry a server id threads correctly, so the guard
  // above is not simply disabling replies.
  it("persists a reply to a server-backed comment as a threaded reply", async () => {
    const post = postWithLocalComment();
    post.comments[0].id = "srv-c-55";
    renderDialog(post);
    await act(async () => {});

    await act(async () => {
      clickByText(/^reply$/i).click();
    });

    const textarea = screen
      .getAllByRole("textbox")
      .find((t) => /reply/i.test(t.getAttribute("placeholder") ?? ""))!;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "Thanks!" } });
    });

    await act(async () => {
      clickByText(/^post$/i).click();
    });

    expect(mockComment).toHaveBeenCalledWith(10, "Thanks!", 55);
  });
});
