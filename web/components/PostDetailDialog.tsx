"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Heart, MessageCircleMore, Bookmark, Flag, X } from "lucide-react";
import { PostMedia } from "@/components/community/PostMedia";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { posts as postsApi, ApiError, type Comment } from "@/lib/api";
import { toast } from "sonner";
import type { SocialPost, PostComment, PostReply } from "@/lib/community-feed";
import {
  toggleLike,
  toggleSave,
  toggleCommentLike,
  addComment,
  addReply,
} from "@/lib/community-feed";

interface PostDetailDialogProps {
  post: SocialPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (post: SocialPost) => void;
  /** Server-aware like write-through (community page passes it); falls back to local toggle. */
  onToggleLike?: (post: SocialPost) => void;
  currentUserName?: string;
  currentUserHandle?: string;
}

/**
 * Drops one comment or reply by id, leaving everything else as it is.
 *
 * Used to undo a single failed optimistic write. Replacing the whole post with the snapshot
 * captured when the request started also undid anything the user did in the meantime — two
 * quick comments where the first failed made the second disappear from the screen while it sat
 * in the database.
 */
function removeCommentById(post: SocialPost, id: string): SocialPost {
  return {
    ...post,
    comments: post.comments
      .filter((c) => c.id !== id)
      .map((c) =>
        c.replies.some((r) => r.id === id)
          ? { ...c, replies: c.replies.filter((r) => r.id !== id) }
          : c
      ),
  };
}

/** Maps a server comment to the local display shape (read-only; replies are lazy/absent). */
function toPostComment(c: Comment): PostComment {
  return {
    id: `srv-c-${c.id}`,
    authorName: c.username,
    authorHandle: c.username,
    copy: c.content,
    createdLabel: c.createdAt,
    replies: [],
  };
}


function AvatarCircle({ handle }: { handle: string }) {
  const initial = handle.replace(/^@/, "").charAt(0).toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium text-primary-foreground bg-gradient-to-br from-brand to-brand/60 shrink-0">
      {initial}
    </div>
  );
}

function ReplyItem({ reply }: { reply: PostReply }) {
  return (
    <div className="flex gap-2">
      <AvatarCircle handle={reply.authorHandle} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            @{reply.authorHandle}
          </span>
          <span className="text-xs text-muted-foreground">{reply.createdLabel}</span>
        </div>
        <p className="text-sm text-foreground mt-0.5">{reply.copy}</p>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  onToggleLike,
  onAddReply,
  activeReplyId,
  onToggleReply,
  replyDraft,
  onReplyDraftChange,
}: {
  comment: PostComment;
  onToggleLike: () => void;
  onAddReply: (commentId: string) => void;
  activeReplyId: string | null;
  onToggleReply: (commentId: string) => void;
  replyDraft: string;
  onReplyDraftChange: (value: string) => void;
}) {
  const isReplyOpen = activeReplyId === comment.id;

  function handleReplyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onAddReply(comment.id);
    }
  }

  return (
    <div className="flex gap-3">
      <AvatarCircle handle={comment.authorHandle} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            @{comment.authorHandle}
          </span>
          <span className="text-xs text-muted-foreground">{comment.createdLabel}</span>
        </div>
        <p className="text-sm text-foreground mt-0.5">{comment.copy}</p>

        <div className="flex items-center gap-3 mt-1.5">
          <button
            onClick={onToggleLike}
            className="flex items-center gap-1 transition-colors duration-150"
          >
            <Heart
              size={13}
              className={
                comment.likedByCurrentUser
                  ? "text-brand fill-brand"
                  : "text-muted-foreground hover:text-brand"
              }
            />
          </button>
          <button
            onClick={() => onToggleReply(comment.id)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            Reply
          </button>
        </div>

        {comment.replies.length > 0 && (
          <div className="mt-3 border-l-2 border-border/60 pl-4 space-y-3">
            {comment.replies.map((reply) => (
              <ReplyItem key={reply.id} reply={reply} />
            ))}
          </div>
        )}

        {isReplyOpen && (
          <div className="mt-2 flex gap-2 items-end">
            <Textarea
              value={replyDraft}
              onChange={(e) => onReplyDraftChange(e.target.value)}
              onKeyDown={handleReplyKeyDown}
              placeholder="Write a reply..."
              rows={1}
              className="resize-none text-sm min-h-0 py-1.5 px-3"
            />
            <button
              onClick={() => onAddReply(comment.id)}
              className="shrink-0 rounded-lg bg-foreground text-background px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-foreground/80 transition-colors duration-150"
            >
              POST
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function PostDetailDialog({
  post,
  open,
  onOpenChange,
  onUpdate,
  onToggleLike,
  currentUserName,
  currentUserHandle,
}: PostDetailDialogProps) {
  const [commentDraft, setCommentDraft] = useState("");
  // The latest post, for the failure path of an optimistic write. Reading the `post` prop from
  // a closure captured when the request started is what made a failed comment undo a later,
  // successful one.
  const postRef = useRef(post);
  postRef.current = post;
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<
    string | null
  >(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  // Tagged with the post the thread was fetched for, so a thread never leaks
  // into a different post while its own fetch is still in flight.
  const [loadedThread, setLoadedThread] = useState<{
    serverId: number;
    comments: PostComment[];
  } | null>(null);
  const serverComments =
    loadedThread && loadedThread.serverId === post.serverId
      ? loadedThread.comments
      : [];

  // Lazy-load real comments for server-backed posts (SocialPost.comments is empty for them).
  useEffect(() => {
    const serverId = post.serverId;
    if (!open || serverId == null) return;
    const ctrl = new AbortController();
    postsApi
      .listComments(serverId, 0, 50, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setLoadedThread({ serverId, comments: res.content.map(toPostComment) });
      })
      .catch(() => {
        // Gate the failure commit too: closing and reopening the same post quickly let a
        // cancelled request's catch write an empty thread over one that had just loaded.
        if (ctrl.signal.aborted) return;
        setLoadedThread({ serverId, comments: [] });
      });
    return () => ctrl.abort();
  }, [open, post.serverId]);

  // Prefer locally-authored comments; otherwise show the lazy-loaded server thread.
  const displayComments = post.comments.length > 0 ? post.comments : serverComments;
  const displayCommentCount =
    post.commentCount ?? Math.max(post.comments.length, serverComments.length);

  // Report abuse → POST /api/posts/{id}/report (idempotent server-side). Only server-backed
  // posts (numeric serverId) are reportable; demo posts have no serverId.
  async function handleReport() {
    if (post.serverId == null) {
      toast.error("This demo post can't be reported");
      return;
    }
    if (!reportReason.trim() || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await postsApi.report(post.serverId, reportReason.trim());
      toast.success("Report submitted. Our team will review it.");
      setReportOpen(false);
      setReportReason("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not submit report");
    } finally {
      setReportSubmitting(false);
    }
  }

  function handleAddComment() {
    const content = commentDraft.trim();
    if (!content) return;
    const updated = addComment(
      post,
      currentUserName ?? "You",
      currentUserHandle ?? "you",
      content
    );
    onUpdate(updated); // optimistic
    setCommentDraft("");
    // The id of the comment just prepended, so a failure can remove exactly that one.
    persistComment(content, undefined, updated.comments[0]?.id);
  }

  /**
   * Sends the comment to the server.
   *
   * Comments were purely local: the UI appended them, said nothing, and the write was
   * discarded — so a user saw their comment, reloaded, and it was gone, and nobody else ever
   * saw it. The endpoint existed the whole time (`POST /api/posts/{id}/comments`).
   *
   * A post with no `serverId` is a seeded demo post that exists only in this browser; there is
   * nothing to persist it to, and that is not an error.
   */
  function persistComment(
    content: string,
    parentCommentId?: number,
    optimisticId?: string
  ) {
    if (post.serverId == null) return;
    postsApi
      .comment(post.serverId, content, parentCommentId)
      .catch((err) => {
        // Remove only the comment that failed, from the CURRENT state — not a wholesale
        // restore of the snapshot captured when this request started. Two quick comments
        // where the first fails and the second succeeds used to make the second disappear
        // from the screen while it sat in the database.
        if (optimisticId) {
          onUpdate(removeCommentById(postRef.current, optimisticId));
        }
        toast.error(
          err instanceof ApiError ? err.message : "Your comment couldn't be saved"
        );
      });
  }

  function handleAddReply(commentId: string) {
    const draft = replyDrafts[commentId]?.trim();
    if (!draft) return;

    // Server comment ids reach the local model prefixed (see toPostComment), so a reply can
    // only be threaded server-side when its parent came from the server.
    const parentId = commentId.startsWith("srv-c-")
      ? Number(commentId.slice("srv-c-".length))
      : undefined;

    // Checked BEFORE the optimistic write, so there is nothing to roll back.
    //
    // A comment authored in this session has no server id yet. Sending its reply anyway meant
    // `parentCommentId` was undefined, and `POST /api/posts/{id}/comments` then created a new
    // TOP-LEVEL comment — the thread was silently flattened server-side and the user was told
    // nothing, so it only showed up on the next reload. Refuse rather than write it to the
    // wrong place. A demo post (no serverId) has nothing to persist to and stays local, which
    // is not an error.
    if (post.serverId != null && !Number.isFinite(parentId)) {
      toast.error(
        "Give the comment you're replying to a moment to save, then try again."
      );
      return;
    }

    const updated = addReply(
      post,
      commentId,
      currentUserName ?? "You",
      currentUserHandle ?? "you",
      draft
    );
    onUpdate(updated); // optimistic
    setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
    setActiveReplyCommentId(null);
    const addedReply = updated.comments
      .find((c) => c.id === commentId)
      ?.replies?.at(-1);
    persistComment(draft, parentId, addedReply?.id);
  }

  function handleToggleReply(commentId: string) {
    setActiveReplyCommentId((prev) => (prev === commentId ? null : commentId));
  }

  function handleCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl 2xl:max-w-[1600px] p-0 rounded-[2rem] overflow-hidden border-0">
        <div className="grid md:grid-cols-[1fr_1.15fr]">
          {/* Left panel — image */}
          <div className="aspect-[4/5] w-full">
            <PostMedia
              src={post.image}
              alt={`Post by @${post.creatorUsername}`}
              className="h-full"
            />
          </div>

          {/* Right panel — comments */}
          <div className="flex flex-col h-full max-h-[80vh] md:max-h-none">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 shrink-0">
              <div>
                <p className="font-semibold text-lg text-foreground">
                  Comments
                </p>
                <Link
                  href={post.ownedByCurrentUser ? "/dashboard" : `/profile/${post.creatorUsername}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                >
                  @{post.creatorUsername}
                </Link>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
              >
                <X size={18} />
              </button>
            </div>

            {/* Caption + Tags */}
            <div className="px-6 py-4 border-b border-border/60 shrink-0">
              <p className="text-sm text-foreground leading-relaxed">
                {post.caption}
              </p>
              {(post.tags.length > 0 || post.productLinks.length > 0) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                  {post.productLinks.map((pl) => (
                    <a
                      key={pl.id}
                      href={pl.href}
                      className="rounded-full bg-brand/10 px-3 py-1 text-xs uppercase text-brand hover:bg-brand/20 transition-colors duration-150"
                    >
                      {pl.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Like / Save row */}
            <div className="flex items-center gap-4 px-6 py-3 border-b border-border/60 shrink-0">
              <button
                onClick={() =>
                  onToggleLike ? onToggleLike(post) : onUpdate(toggleLike(post))
                }
                className="flex items-center gap-1.5 transition-colors duration-150"
              >
                <Heart
                  size={18}
                  className={
                    post.likedByCurrentUser
                      ? "text-brand fill-brand"
                      : "text-muted-foreground hover:text-brand"
                  }
                />
                <span className="text-sm text-muted-foreground">{post.likeCount}</span>
              </button>

              <button
                onClick={() => onUpdate(toggleSave(post))}
                className="transition-colors duration-150"
              >
                <Bookmark
                  size={18}
                  className={
                    post.savedByCurrentUser
                      ? "text-foreground fill-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }
                />
              </button>

              <button className="flex items-center gap-1.5 text-muted-foreground ml-auto">
                <MessageCircleMore size={18} />
                <span className="text-sm">{displayCommentCount}</span>
              </button>

              <button
                onClick={() => setReportOpen((v) => !v)}
                aria-label="Report post"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-destructive transition-colors duration-150"
              >
                <Flag size={18} />
              </button>
            </div>

            {reportOpen && (
              <div className="flex flex-col gap-2 px-6 py-3 border-b border-border/60 shrink-0">
                <Textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Why are you reporting this post?"
                  rows={2}
                  className="resize-none rounded-xl text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setReportOpen(false);
                      setReportReason("");
                    }}
                    className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={reportSubmitting || !reportReason.trim()}
                    className="rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    {reportSubmitting ? "Submitting…" : "Submit report"}
                  </button>
                </div>
              </div>
            )}

            {/* Comment thread */}
            <ScrollArea className="flex-1 px-6 py-4">
              {displayComments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                <div className="space-y-4">
                  {displayComments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      onToggleLike={() =>
                        onUpdate(toggleCommentLike(post, comment.id))
                      }
                      onAddReply={handleAddReply}
                      activeReplyId={activeReplyCommentId}
                      onToggleReply={handleToggleReply}
                      replyDraft={replyDrafts[comment.id] ?? ""}
                      onReplyDraftChange={(value) =>
                        setReplyDrafts((prev) => ({
                          ...prev,
                          [comment.id]: value,
                        }))
                      }
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Bottom comment input */}
            <div className="flex items-end gap-3 px-6 py-4 border-t border-border/60 shrink-0">
              <Textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={handleCommentKeyDown}
                placeholder="Add a comment..."
                rows={1}
                className="resize-none flex-1"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentDraft.trim()}
                className="shrink-0 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-semibold uppercase tracking-wide hover:bg-foreground/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              >
                POST
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
