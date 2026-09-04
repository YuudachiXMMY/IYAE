import type { SocialPost, DashboardTab, PersistedCommunityState } from "./community-feed";
import { isPostActive } from "./community-feed";


export type { DashboardTab } from "./community-feed";

export function getProfileTabPosts(
  state: PersistedCommunityState,
  username: string,
  tab: DashboardTab
): SocialPost[] {
  switch (tab) {
    case "outfit-posts":
      return state.posts.filter(
        (p) => p.creatorUsername === username && isPostActive(p)
      );
    case "saved":
      return state.posts.filter(
        (p) => p.savedByCurrentUser === true && isPostActive(p)
      );
    case "reposted":
      return state.posts.filter(
        (p) => p.repostedByCurrentUser === true && isPostActive(p)
      );
    case "tagged":
      return state.posts.filter(
        (p) => (p.taggedUsernames ?? []).includes(username) && isPostActive(p)
      );
    case "archives":
      return state.posts.filter(
        (p) => p.creatorUsername === username && p.lifecycleState === "archived"
      );
    default:
      return [];
  }
}

export function getProfileStats(
  state: PersistedCommunityState,
  username: string
): { posts: number; followers: number; following: number; archives: number } {
  const posts = state.posts.filter(
    (p) => p.creatorUsername === username && isPostActive(p)
  ).length;
  const following = state.followedUsernames.length;
  const followers = 0;
  const archives = state.posts.filter(
    (p) => p.creatorUsername === username && p.lifecycleState === "archived"
  ).length;
  return { posts, followers, following, archives };
}

export function getBodyMeasurementCoverage(
  user: Record<string, unknown>
): number {
  const fields = [
    "heightCm",
    "weightKg",
    "chestCm",
    "waistCm",
    "hipsCm",
    "shoulderWidthCm",
    "inseamCm",
    "shoeSize",
    "topSize",
    "bottomSize",
    "dressSize",
    "jacketSize",
  ];
  const filled = fields.filter(
    (f) => user[f] !== undefined && user[f] !== null && user[f] !== ""
  ).length;
  return Math.round((filled / fields.length) * 100);
}
