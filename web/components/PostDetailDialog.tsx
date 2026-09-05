"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircleMore, Bookmark, X } from "lucide-react";
import { PostMedia } from "@/components/community/PostMedia";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  currentUserName?: string;
  currentUserHandle?: string;
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
  currentUserName,
  currentUserHandle,
}: PostDetailDialogProps) {
  const [commentDraft, setCommentDraft] = useState("");
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<
    string | null
  >(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  function handleAddComment() {
    if (!commentDraft.trim()) return;
    const updated = addComment(
      post,
      currentUserName ?? "You",
      currentUserHandle ?? "you",
      commentDraft.trim()
    );
    onUpdate(updated);
    setCommentDraft("");
  }

  function handleAddReply(commentId: string) {
    const draft = replyDrafts[commentId]?.trim();
    if (!draft) return;
    const updated = addReply(
      post,
      commentId,
      currentUserName ?? "You",
      currentUserHandle ?? "you",
      draft
    );
    onUpdate(updated);
    setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
    setActiveReplyCommentId(null);
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
                onClick={() => onUpdate(toggleLike(post))}
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
                <span className="text-sm">{post.comments.length}</span>
              </button>
            </div>

            {/* Comment thread */}
            <ScrollArea className="flex-1 px-6 py-4">
              {post.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                <div className="space-y-4">
                  {post.comments.map((comment) => (
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
