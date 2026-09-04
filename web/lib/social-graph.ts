export interface SocialProfile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  styleAesthetics: string[];
  followerCount: number;
  followingCount: number;
  outfitCount: number;
  isVerified: boolean;
  avatarTone: [string, string];
  bannerTone: [string, string];
  location: string;
  headline: string;
}

const IS_PROD = process.env.NODE_ENV === "production";

export const SOCIAL_PROFILES: SocialProfile[] = IS_PROD ? [] : [
  {
    username: "mila.rue",
    displayName: "Mila Rue",
    bio: "Minimalist curator — less noise, more intention. Fashion as a form of self-editing.",
    avatarUrl: null,
    styleAesthetics: ["Minimalist", "Luxury", "Date nights"],
    followerCount: 18420,
    followingCount: 312,
    outfitCount: 94,
    isVerified: true,
    avatarTone: ["#f4d1dc", "#e7d6ff"],
    bannerTone: ["#f4d1dc", "#e7d6ff"],
    location: "New York",
    headline: "Less noise, more intention",
  },
  {
    username: "studio.iris",
    displayName: "Studio Iris",
    bio: "Archive fashion + creative direction. Mixing decades, not matching them.",
    avatarUrl: null,
    styleAesthetics: ["Vintage", "Grunge", "Content creation"],
    followerCount: 9310,
    followingCount: 487,
    outfitCount: 112,
    isVerified: true,
    avatarTone: ["#d9cfc8", "#c8d4ff"],
    bannerTone: ["#d9cfc8", "#c8d4ff"],
    location: "London",
    headline: "Mixing decades, not matching them",
  },
  {
    username: "nori.afterclass",
    displayName: "Nori Hale",
    bio: "Campus style diaries — athleisure meets clean girl energy.",
    avatarUrl: null,
    styleAesthetics: ["Clean girl", "School", "Athleisure"],
    followerCount: 4120,
    followingCount: 890,
    outfitCount: 38,
    isVerified: false,
    avatarTone: ["#e2d9d7", "#d7efe7"],
    bannerTone: ["#e2d9d7", "#d7efe7"],
    location: "Toronto",
    headline: "Campus style diaries",
  },
  {
    username: "lena.vale",
    displayName: "Lena Vale",
    bio: "Scandi-minimal travel capsules. Packing light, looking right.",
    avatarUrl: null,
    styleAesthetics: ["Business casual", "Scandinavian minimalism", "Travel"],
    followerCount: 6880,
    followingCount: 245,
    outfitCount: 67,
    isVerified: false,
    avatarTone: ["#ece6df", "#d7e3e8"],
    bannerTone: ["#ece6df", "#d7e3e8"],
    location: "Copenhagen",
    headline: "Packing light, looking right",
  },
  {
    username: "kai.mercer",
    displayName: "Kai Mercer",
    bio: "Streetwear architect. If it doesn't turn heads, it stays on the rack.",
    avatarUrl: null,
    styleAesthetics: ["Streetwear", "Edgy", "Everyday"],
    followerCount: 22100,
    followingCount: 198,
    outfitCount: 156,
    isVerified: true,
    avatarTone: ["#d9d1d7", "#cfc9c6"],
    bannerTone: ["#d9d1d7", "#cfc9c6"],
    location: "Los Angeles",
    headline: "If it doesn't turn heads, it stays on the rack",
  },
  {
    username: "aya.lin",
    displayName: "Aya Lin",
    bio: "Soft power dressing — from boardroom to brunch without changing.",
    avatarUrl: null,
    styleAesthetics: ["Soft girl", "Work", "Formal events"],
    followerCount: 5790,
    followingCount: 356,
    outfitCount: 51,
    isVerified: false,
    avatarTone: ["#f1d7e0", "#dce7f5"],
    bannerTone: ["#f1d7e0", "#dce7f5"],
    location: "Vancouver",
    headline: "Soft power dressing",
  },
];

export const DEFAULT_FOLLOWED: string[] = [];

export function findSocialProfile(username: string): SocialProfile | undefined {
  return SOCIAL_PROFILES.find((p) => p.username === username);
}
