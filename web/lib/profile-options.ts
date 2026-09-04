export const STYLE_AESTHETICS = [
  "Streetwear", "Minimalist", "Y2K", "Old money", "Coquette",
  "Athleisure", "Vintage", "Grunge", "Clean girl", "Luxury",
  "Business casual", "Soft girl", "Edgy", "Scandinavian minimalism"
] as const;

export const FIT_PREFERENCES = [
  "Oversized", "Relaxed fit", "Tight fitted", "Cropped",
  "Layered", "Baggy", "Tailored"
] as const;

export const COLOR_PALETTE = [
  { name: "Black", hex: "#171311" },
  { name: "Cream", hex: "#f5efe8" },
  { name: "Chocolate", hex: "#5c3d2e" },
  { name: "Olive", hex: "#6b7c3e" },
  { name: "Sky", hex: "#7ec8e3" },
  { name: "Cobalt", hex: "#2d4a9e" },
  { name: "Cherry", hex: "#9e2b2b" },
  { name: "Blush", hex: "#e8c4c4" },
  { name: "Silver", hex: "#c0c0c0" },
  { name: "Butter", hex: "#f5e6a3" },
] as const;

export const BRANDS = [
  "Zara", "H&M", "Uniqlo", "Nike", "Adidas",
  "COS", "Arket", "& Other Stories", "Everlane", "Reformation",
  "Patagonia", "Mango", "ASOS", "Massimo Dutti"
] as const;

export const BUDGET_RANGES = [
  "Under $80", "$80-$180", "$180-$350", "$350+"
] as const;

export const OUTFIT_GOALS = [
  "Everyday", "School", "Work", "Formal events",
  "Date nights", "Travel", "Content creation", "Gym/activewear"
] as const;

export const AGE_RANGES = [
  "Under 18", "18-21", "22-25", "26-30", "31+"
] as const;

export const GENDER_OPTIONS = [
  "Female", "Male", "Prefer not to say"
] as const;

export const AVATAR_MODES = [
  "AI avatar", "Profile photo"
] as const;

export const AVATAR_PRESETS = [
  "Runway realism", "Studio mirror", "Creator crop", "Off-duty fit cam"
] as const;

export const PRICE_PREFERENCE = [
  "Affordable-first", "Balanced mix", "Luxury-first"
] as const;
