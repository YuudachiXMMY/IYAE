export interface SocialProfile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  styleAesthetics: string[];
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
    isVerified: true,
    avatarTone: ["var(--color-muted)", "var(--color-card)"],
    bannerTone: ["var(--color-muted)", "var(--color-card)"],
    location: "New York",
    headline: "Less noise, more intention",
  },
  {
    username: "studio.iris",
    displayName: "Studio Iris",
    bio: "Archive fashion + creative direction. Mixing decades, not matching them.",
    avatarUrl: null,
    styleAesthetics: ["Vintage", "Grunge", "Content creation"],
    isVerified: true,
    avatarTone: ["var(--color-muted)", "var(--color-card)"],
    bannerTone: ["var(--color-muted)", "var(--color-card)"],
    location: "London",
    headline: "Mixing decades, not matching them",
  },
  {
    username: "nori.afterclass",
    displayName: "Nori Hale",
    bio: "Campus style diaries — athleisure meets clean girl energy.",
    avatarUrl: null,
    styleAesthetics: ["Clean girl", "School", "Athleisure"],
    isVerified: false,
    avatarTone: ["var(--color-muted)", "var(--color-card)"],
    bannerTone: ["var(--color-muted)", "var(--color-card)"],
    location: "Toronto",
    headline: "Campus style diaries",
  },
  {
    username: "lena.vale",
    displayName: "Lena Vale",
    bio: "Scandi-minimal travel capsules. Packing light, looking right.",
    avatarUrl: null,
    styleAesthetics: ["Business casual", "Scandinavian minimalism", "Travel"],
    isVerified: false,
    avatarTone: ["var(--color-muted)", "var(--color-card)"],
    bannerTone: ["var(--color-muted)", "var(--color-card)"],
    location: "Copenhagen",
    headline: "Packing light, looking right",
  },
  {
    username: "kai.mercer",
    displayName: "Kai Mercer",
    bio: "Streetwear architect. If it doesn't turn heads, it stays on the rack.",
    avatarUrl: null,
    styleAesthetics: ["Streetwear", "Edgy", "Everyday"],
    isVerified: true,
    avatarTone: ["var(--color-muted)", "var(--color-card)"],
    bannerTone: ["var(--color-muted)", "var(--color-card)"],
    location: "Los Angeles",
    headline: "If it doesn't turn heads, it stays on the rack",
  },
  {
    username: "aya.lin",
    displayName: "Aya Lin",
    bio: "Soft power dressing — from boardroom to brunch without changing.",
    avatarUrl: null,
    styleAesthetics: ["Soft girl", "Work", "Formal events"],
    isVerified: false,
    avatarTone: ["var(--color-muted)", "var(--color-card)"],
    bannerTone: ["var(--color-muted)", "var(--color-card)"],
    location: "Vancouver",
    headline: "Soft power dressing",
  },
];

export const DEFAULT_FOLLOWED: string[] = [];

export function findSocialProfile(username: string): SocialProfile | undefined {
  return SOCIAL_PROFILES.find((p) => p.username === username);
}
