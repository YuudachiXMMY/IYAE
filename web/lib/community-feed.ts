"use client";

// Type-only import (erased at build) — keeps this pure module free of the runtime api client.
import type { Post, CommunityPostStatus } from "@/lib/api";

export type PostType = "outfit_photo" | "ai_outfit" | "wearing_it" | "ar_try_on";
// Phase 6: the three server-backed named feeds join the local views. `saved`/`reposted`
// stay LOCAL personal collections (not server feeds); CommunityTab = FeedView ∪ those.
export type FeedView = "for-you" | "following" | "discover" | "toronto" | "body-confidence";
export type CommunityTab = FeedView | "saved" | "reposted";
export type LifecycleState = "active" | "archived" | "pending_delete";

export interface ProductLink {
  id: string;
  label: string;
  href: string;
  slot?: string;
  productId?: number;
  colors?: string[];
}

export interface PostReply {
  id: string;
  authorName: string;
  authorHandle: string;
  copy: string;
  createdLabel: string;
  likedByCurrentUser?: boolean;
}

export interface PostComment {
  id: string;
  authorName: string;
  authorHandle: string;
  copy: string;
  createdLabel: string;
  likedByCurrentUser?: boolean;
  replies: PostReply[];
}

export interface SocialPost {
  id: string;
  /** Numeric server post id when server-backed — enables like/report write-through. */
  serverId?: number;
  /** Numeric author id when server-backed — enables real follow write-through. */
  creatorUserId?: number;
  creatorUsername: string;
  creatorName: string;
  image: string;
  caption: string;
  postedAt: string;
  type: PostType;
  tags: string[];
  productLinks: ProductLink[];
  feedViews: FeedView[];
  likeCount: number;
  /** Real server comment aggregate when server-backed; UI prefers it over comments.length. */
  commentCount?: number;
  comments: PostComment[];
  likedByCurrentUser?: boolean;
  savedByCurrentUser?: boolean;
  repostedByCurrentUser?: boolean;
  ownedByCurrentUser?: boolean;
  lifecycleState?: LifecycleState;
  deleteRequestedAt?: string | null;
  taggedUsernames?: string[];
}

export type DashboardTab = "outfit-posts" | "saved" | "reposted" | "tagged" | "archives";

export interface CreatePostInput {
  creatorUsername: string;
  creatorName: string;
  image: string;
  caption: string;
  type: PostType;
  tags: string[];
  productLinks: ProductLink[];
}

export interface PersistedCommunityState {
  followedUsernames: string[];
  posts: SocialPost[];
  version?: number;
}

const COMMUNITY_STATE_VERSION = 4;

const IS_PROD = process.env.NODE_ENV === "production";

function storageKey(userId: string): string {
  return `clossette-community-state-${userId}`;
}

export function buildDemoSeedPosts(): SocialPost[] {
  return [
    {
      id: "community-1",
      creatorUsername: "mila.rue",
      creatorName: "Mila Rue",
      image: "/assets/images/community/post-1.svg",
      caption:
        "Structured shoulder, fitted base, and silver accents for a polished night-out silhouette.",
      postedAt: "2h",
      type: "outfit_photo",
      tags: ["Minimalist", "Luxury", "Date nights"],
      productLinks: [
        { id: "pl-1-1", label: "Shop this jacket", href: "/products/1", slot: "Outerwear", productId: 1, colors: ["Silver", "Black"] },
        { id: "pl-1-2", label: "Shop these pants", href: "/products/2", slot: "Pants", productId: 2 },
        { id: "pl-1-3", label: "Shop entire outfit", href: "/outfits/1/view" },
      ],
      feedViews: ["for-you"],
      likeCount: 12000,
      comments: [
        {
          id: "seed-comment-1",
          authorName: "Sarah Du",
          authorHandle: "sarahdu",
          copy: "Love the proportions here, especially the shoulder line.",
          createdLabel: "1h",
          replies: [],
        },
      ],
      likedByCurrentUser: false,
      savedByCurrentUser: false,
      repostedByCurrentUser: false,
      lifecycleState: "active",
      taggedUsernames: ["closette"],
    },
    {
      id: "community-2",
      creatorUsername: "studio.iris",
      creatorName: "Studio Iris",
      image: "/assets/images/community/post-2.svg",
      caption:
        "Layered knit texture with a cleaner bottom silhouette for movement and camera-ready lines.",
      postedAt: "4h",
      type: "outfit_photo",
      tags: ["Vintage", "Grunge", "Content creation"],
      productLinks: [
        { id: "pl-2-1", label: "Shop this top", href: "/products/3", slot: "Top", productId: 3 },
        { id: "pl-2-2", label: "Shop entire outfit", href: "/outfits/2/view" },
      ],
      feedViews: ["for-you", "following"],
      likeCount: 9800,
      comments: [
        {
          id: "seed-comment-2",
          authorName: "Mila Rue",
          authorHandle: "mila.rue",
          copy: "Saved this one for my next dinner plan.",
          createdLabel: "2h",
          replies: [],
        },
      ],
      likedByCurrentUser: false,
      savedByCurrentUser: false,
      repostedByCurrentUser: false,
      lifecycleState: "active",
      taggedUsernames: ["mila.rue"],
    },
    {
      id: "community-4",
      creatorUsername: "kai.mercer",
      creatorName: "Kai Mercer",
      image: "/assets/images/community/post-4.svg",
      caption:
        "Utility-driven layers with cleaner details for a city-ready proportion.",
      postedAt: "2d",
      type: "outfit_photo",
      tags: ["Streetwear", "Edgy"],
      productLinks: [
        { id: "pl-4-1", label: "Shop entire outfit", href: "/outfits/6/view" },
      ],
      feedViews: ["for-you"],
      likeCount: 6200,
      comments: [],
      likedByCurrentUser: false,
      savedByCurrentUser: false,
      repostedByCurrentUser: false,
      lifecycleState: "active",
      taggedUsernames: [],
    },
  ];
}

export function buildCurrentUserSeedPost(
  displayName: string,
  username: string,
  aesthetic: string
): SocialPost {
  return {
    id: "community-3",
    creatorUsername: username,
    creatorName: displayName,
    image: "/assets/images/community/post-3.svg",
    caption:
      "Pinned this minimalist fit to keep the silhouette and palette logic in my own archive.",
    postedAt: "1d",
    type: "outfit_photo",
    tags: [aesthetic, "Everyday", "Personal archive"],
    productLinks: [
      { id: "pl-3-1", label: "Shop this jacket", href: "/products/5", slot: "Outerwear", productId: 5 },
      { id: "pl-3-2", label: "Shop entire outfit", href: "/outfits/5/view" },
    ],
    feedViews: ["for-you"],
    likeCount: 284,
    comments: [
      {
        id: "seed-comment-3",
        authorName: "Mila Rue",
        authorHandle: "mila.rue",
        copy: "This base is really strong.",
        createdLabel: "8h",
        replies: [],
      },
    ],
    likedByCurrentUser: false,
    savedByCurrentUser: false,
    repostedByCurrentUser: false,
    ownedByCurrentUser: true,
    lifecycleState: "active",
    taggedUsernames: ["mila.rue", "studio.iris"],
  };
}

export function buildInitialCommunityPosts(
  displayName: string,
  username: string,
  aesthetic: string
): SocialPost[] {
  if (IS_PROD) return [];
  const demoSeeds = buildDemoSeedPosts();
  const userSeed = buildCurrentUserSeedPost(displayName, username, aesthetic);
  // Order: post-1 (Mila), post-2 (Studio Iris), post-3 (user), post-4 (Kai)
  return [demoSeeds[0], demoSeeds[1], userSeed, demoSeeds[2]];
}

export function migrateCommunityState(
  state: PersistedCommunityState,
  displayName: string,
  username: string,
  aesthetic: string
): PersistedCommunityState {
  if (state.version === COMMUNITY_STATE_VERSION) return state;

  const hasCommunitySeeds = state.posts.some((p) => p.id.startsWith("community-"));

  // If there are no community-prefixed seed posts, apply field migrations and stamp the version
  if (!hasCommunitySeeds) {
    const postsWithTagged = state.posts.map((p) =>
      p.taggedUsernames === undefined ? { ...p, taggedUsernames: [] } : p
    );
    return { ...state, posts: postsWithTagged, version: COMMUNITY_STATE_VERSION };
  }

  // Build new canonical seeds
  const newSeeds = buildInitialCommunityPosts(displayName, username, aesthetic);

  // Preserve user interaction flags, comments, and lifecycle state from old posts
  const migratedPosts = newSeeds.map((seed) => {
    const oldPost = state.posts.find(
      (p) => p.id.startsWith("community-") && p.creatorUsername === seed.creatorUsername
    );
    if (!oldPost) return seed;
    return {
      ...seed,
      likedByCurrentUser: oldPost.likedByCurrentUser ?? seed.likedByCurrentUser,
      savedByCurrentUser: oldPost.savedByCurrentUser ?? seed.savedByCurrentUser,
      repostedByCurrentUser: oldPost.repostedByCurrentUser ?? seed.repostedByCurrentUser,
      comments: oldPost.comments.length > 0 ? oldPost.comments : seed.comments,
      lifecycleState: oldPost.lifecycleState ?? seed.lifecycleState,
      deleteRequestedAt: oldPost.deleteRequestedAt ?? seed.deleteRequestedAt,
      taggedUsernames: seed.taggedUsernames,
    };
  });

  // Keep any non-seed posts the user may have (posts without "community-" prefix)
  // Also ensure taggedUsernames field exists on all user posts
  const userPosts = state.posts
    .filter((p) => !p.id.startsWith("community-"))
    .map((p) => (p.taggedUsernames === undefined ? { ...p, taggedUsernames: [] } : p));

  return {
    followedUsernames: state.followedUsernames,
    posts: [...migratedPosts, ...userPosts],
    version: COMMUNITY_STATE_VERSION,
  };
}

export function isPostActive(post: SocialPost): boolean {
  const state = post.lifecycleState ?? "active";
  return state === "active";
}

export function getFeedByTab(
  tab: CommunityTab,
  posts: SocialPost[],
  followedUsernames: string[]
): SocialPost[] {
  const active = posts.filter(isPostActive);
  switch (tab) {
    case "for-you":
      return active.filter((p) => p.feedViews.includes("for-you"));
    case "following":
      return active.filter((p) =>
        followedUsernames.includes(p.creatorUsername)
      );
    case "saved":
      return active.filter((p) => p.savedByCurrentUser === true);
    case "reposted":
      return active.filter((p) => p.repostedByCurrentUser === true);
    case "discover":
    case "toronto":
    case "body-confidence":
      return active.filter((p) => p.feedViews.includes(tab));
    default:
      return active;
  }
}

// ── Server adapter (Phase 6) ────────────────────────────────────────────────────

function toLifecycleState(status: CommunityPostStatus): LifecycleState {
  switch (status) {
    case "ARCHIVED":
      return "archived";
    case "PENDING_DELETE":
      return "pending_delete";
    default:
      return "active";
  }
}

/**
 * Maps a server {@link Post} to the UI {@link SocialPost}. Pure + deterministic
 * (no Date.now / network / localStorage). Counts are passed through verbatim — REAL
 * server aggregates, never fabricated. The string `id` is namespaced (`server-<id>`)
 * so server posts never collide with demo/user posts; `serverId`/`creatorUserId`
 * carry the numeric ids for like/report/follow write-through.
 */
export function toSocialPost(serverPost: Post): SocialPost {
  const feedViews: FeedView[] = ["discover"];
  if (serverPost.city) feedViews.push("toronto");
  if (serverPost.topic === "body-confidence") feedViews.push("body-confidence");
  return {
    id: `server-${serverPost.id}`,
    serverId: serverPost.id,
    creatorUserId: serverPost.userId,
    creatorUsername: serverPost.username,
    creatorName: serverPost.username,
    image: serverPost.mediaUrls[0] ?? "/assets/images/products/placeholder.svg",
    caption: serverPost.content ?? "",
    postedAt: serverPost.createdAt,
    type: "outfit_photo",
    tags: serverPost.topic ? [serverPost.topic] : [],
    productLinks: serverPost.productIds.map((pid, i) => ({
      id: `server-${serverPost.id}-pl-${i}`,
      label: "Shop this item",
      href: `/products/${pid}`,
      productId: Number(pid),
    })),
    feedViews,
    likeCount: serverPost.likeCount,
    commentCount: serverPost.commentCount, // REAL server aggregate (comments lazy-load on open)
    comments: [],
    likedByCurrentUser: serverPost.likedByCurrentUser,
    savedByCurrentUser: false,
    repostedByCurrentUser: false,
    lifecycleState: toLifecycleState(serverPost.status),
    deleteRequestedAt: null,
    taggedUsernames: [],
  };
}

export function toggleLike(post: SocialPost): SocialPost {
  const liked = !post.likedByCurrentUser;
  return {
    ...post,
    likedByCurrentUser: liked,
    likeCount: liked ? post.likeCount + 1 : post.likeCount - 1,
  };
}

export function toggleSave(post: SocialPost): SocialPost {
  return { ...post, savedByCurrentUser: !post.savedByCurrentUser };
}

export function toggleRepost(post: SocialPost): SocialPost {
  return { ...post, repostedByCurrentUser: !post.repostedByCurrentUser };
}

export function addComment(
  post: SocialPost,
  authorName: string,
  authorHandle: string,
  copy: string
): SocialPost {
  const newComment: PostComment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    authorName,
    authorHandle,
    copy,
    createdLabel: "Just now",
    replies: [],
  };
  return { ...post, comments: [newComment, ...post.comments] };
}

export function addReply(
  post: SocialPost,
  commentId: string,
  authorName: string,
  authorHandle: string,
  copy: string
): SocialPost {
  const newReply: PostReply = {
    id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    authorName,
    authorHandle,
    copy,
    createdLabel: "Just now",
  };
  return {
    ...post,
    comments: post.comments.map((c) =>
      c.id === commentId ? { ...c, replies: [...c.replies, newReply] } : c
    ),
  };
}

export function toggleCommentLike(
  post: SocialPost,
  commentId: string
): SocialPost {
  return {
    ...post,
    comments: post.comments.map((c) =>
      c.id === commentId
        ? { ...c, likedByCurrentUser: !c.likedByCurrentUser }
        : c
    ),
  };
}

export function buildOutfitGeneratorHref(
  post: SocialPost,
  mode: "shop" | "similar"
): string {
  const eventTags = [
    "Date nights",
    "School",
    "Work",
    "Travel",
    "Formal events",
    "Everyday",
    "Gym/activewear",
    "Content creation",
  ];
  const event = post.tags.find((t) => eventTags.includes(t)) ?? "Everyday";
  const styleTags = [
    "Minimalist",
    "Streetwear",
    "Vintage",
    "Y2K",
    "Grunge",
    "Luxury",
    "Athleisure",
    "Clean girl",
    "Soft girl",
    "Edgy",
    "Business casual",
    "Scandinavian minimalism",
    "Old money",
    "Coquette",
  ];
  const style = post.tags.find((t) => styleTags.includes(t)) ?? "";
  const seedIds = post.productLinks.map((pl) => pl.id).join(",");
  const params = new URLSearchParams();
  params.set("event", event);
  if (style) params.set("style", style);
  params.set("source", mode);
  if (mode === "similar") params.set("autogenerate", "1");
  if (seedIds) params.set("seedProductIds", seedIds);

  // Additive: enrich with product metadata from productLinks when available
  const firstLink = post.productLinks[0];
  if (firstLink) {
    if (firstLink.colors && firstLink.colors.length > 0) {
      params.set("colors", firstLink.colors.join(","));
    }
    if (firstLink.productId !== undefined) {
      params.set("seedProductId", String(firstLink.productId));
    }
  }
  const seedSlots = post.productLinks
    .map((pl) => pl.slot)
    .filter((s): s is string => s !== undefined);
  if (seedSlots.length > 0) {
    params.set("seedSlots", seedSlots.join(","));
  }

  return `/outfits?${params.toString()}`;
}

export function requestDelete(post: SocialPost): SocialPost {
  return {
    ...post,
    lifecycleState: "pending_delete",
    deleteRequestedAt: new Date().toISOString(),
  };
}

export function pruneDeletedPosts(posts: SocialPost[]): SocialPost[] {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return posts.filter((p) => {
    if (p.lifecycleState !== "pending_delete") return true;
    if (!p.deleteRequestedAt) return true;
    return Date.now() - new Date(p.deleteRequestedAt).getTime() < thirtyDaysMs;
  });
}

export function loadCommunityState(
  userId: string,
  displayName: string,
  username: string,
  aesthetic: string
): PersistedCommunityState {
  if (typeof window === "undefined") {
    return {
      followedUsernames: [],
      posts: buildInitialCommunityPosts(displayName, username, aesthetic),
    };
  }
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedCommunityState;
      const pruned = { ...parsed, posts: pruneDeletedPosts(parsed.posts) };
      const migrated = migrateCommunityState(pruned, displayName, username, aesthetic);
      if (migrated !== pruned) saveCommunityState(userId, migrated);
      return migrated;
    }
  } catch {
    /* ignore */
  }
  const initial: PersistedCommunityState = {
    followedUsernames: [],
    posts: buildInitialCommunityPosts(displayName, username, aesthetic),
    version: COMMUNITY_STATE_VERSION,
  };
  saveCommunityState(userId, initial);
  return initial;
}

export function saveCommunityState(
  userId: string,
  state: PersistedCommunityState
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function updatePostInState(
  state: PersistedCommunityState,
  updatedPost: SocialPost
): PersistedCommunityState {
  return {
    ...state,
    followedUsernames: state.followedUsernames,
    posts: state.posts.map((p) =>
      p.id === updatedPost.id ? updatedPost : p
    ),
  };
}

export function toggleFollow(
  state: PersistedCommunityState,
  username: string
): PersistedCommunityState {
  const isFollowing = state.followedUsernames.includes(username);
  return {
    ...state,
    followedUsernames: isFollowing
      ? state.followedUsernames.filter((u) => u !== username)
      : [...state.followedUsernames, username],
  };
}

export function createPost(input: CreatePostInput): SocialPost {
  return {
    id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    creatorUsername: input.creatorUsername,
    creatorName: input.creatorName,
    image: input.image,
    caption: input.caption,
    type: input.type,
    tags: input.tags,
    productLinks: input.productLinks,
    feedViews: ["for-you"],
    likeCount: 0,
    comments: [],
    likedByCurrentUser: false,
    savedByCurrentUser: false,
    repostedByCurrentUser: false,
    ownedByCurrentUser: true,
    lifecycleState: "active",
    taggedUsernames: [],
    postedAt: "Just now",
  };
}

export function archivePost(post: SocialPost): SocialPost {
  return { ...post, lifecycleState: "archived" };
}

export function restorePost(post: SocialPost): SocialPost {
  return { ...post, lifecycleState: "active" };
}

export function addPostToState(
  state: PersistedCommunityState,
  post: SocialPost
): PersistedCommunityState {
  return { ...state, posts: [post, ...state.posts] };
}
