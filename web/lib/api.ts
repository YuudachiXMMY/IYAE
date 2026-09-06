const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

let isRedirecting = false;

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("clossette_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Token expired or invalid - clear and redirect
      if (typeof window !== "undefined" && !isRedirecting) {
        isRedirecting = true;
        localStorage.removeItem("clossette_token");
        window.location.href = "/login";
      }
    }
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new ApiError(res.status, error.message || error.error || `HTTP ${res.status}`);
  }

  const text = await res.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { ApiError };
export type { RequestOptions };

export type ProfileVisibility = "PUBLIC" | "PRIVATE";
export type AvatarMode = "AI_AVATAR" | "PROFILE_PHOTO";

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  role: "BUYER" | "DESIGNER";
  username?: string;
  ageRange?: string;
  genderIdentity?: string;
  profileVisibility?: ProfileVisibility;
  bodyProfileVisibility?: ProfileVisibility;
  styleAesthetics?: string[];
  fitPreferences?: string[];
  favoriteColors?: string[];
  avoidedColors?: string[];
  budgetRange?: string;
  favoriteBrands?: string[];
  sustainableFashionInterest?: boolean;
  pricePreference?: string;
  outfitGoals?: string[];
  avatarMode?: AvatarMode;
  avatarPreset?: string;
  heightCm?: number;
  weightKg?: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  shoulderWidthCm?: number;
  inseamCm?: number;
  shoeSize?: string;
  topSize?: string;
  bottomSize?: string;
  dressSize?: string;
  jacketSize?: string;
}

export type UpdateProfileRequest = Omit<RegisterRequest, "email" | "password" | "role">;

export interface UserResponse {
  id: number;
  email: string;
  name: string | null;
  role: "BUYER" | "DESIGNER";
  emailVerified: boolean;
  username?: string | null;
  ageRange?: string | null;
  genderIdentity?: string | null;
  profileVisibility?: ProfileVisibility;
  bodyProfileVisibility?: ProfileVisibility;
  styleAesthetics?: string[] | null;
  fitPreferences?: string[] | null;
  favoriteColors?: string[] | null;
  avoidedColors?: string[] | null;
  budgetRange?: string | null;
  favoriteBrands?: string[] | null;
  sustainableFashionInterest?: boolean | null;
  pricePreference?: string | null;
  outfitGoals?: string[] | null;
  avatarMode?: AvatarMode | null;
  avatarPreset?: string | null;
  createdAt?: string | null;
}

export interface AvatarResponse {
  avatarUrl: string | null;
  status: string;
}

export const auth = {
  register: (data: RegisterRequest) => api.post<{ token: string; user: UserResponse }>("/api/auth/register", data),
  login: (email: string, password: string) => api.post<{ token: string; user: UserResponse }>("/api/auth/login", { email, password }),
  me: () => api.get<UserResponse>("/api/auth/me"),
  updateProfile: (data: UpdateProfileRequest) => api.put<UserResponse>("/api/auth/me", data),
};

export interface RiggingStatusResponse {
  status: "PENDING" | "RUNNING" | "READY" | "FAILED" | "NONE";
  riggedGlbUrl: string | null;
  errorMessage: string | null;
  failureCode: string | null;
  attemptCount: number;
}

export const rigging = {
  getStatus: (productId: number, signal?: AbortSignal) =>
    api.get<RiggingStatusResponse>(`/api/designer/products/${productId}/rigging-status`, { signal }),
  trigger: (productId: number) =>
    api.post<RiggingStatusResponse>(`/api/designer/products/${productId}/rigging`),
  retry: (productId: number) =>
    api.post<RiggingStatusResponse>(`/api/designer/products/${productId}/rigging-status/retry`),
};

// ── Outfit types ──────────────────────────────────────────────────────────────

/**
 * The four garment slots an outfit item can occupy. Mirrors the server contract
 * (`OutfitService.VALID_SLOT_NAMES`); typing `slot` as this union — instead of a
 * bare `string` — keeps slot label/order maps exhaustive on the consuming pages.
 */
export type SlotName = "top" | "bottom" | "shoes" | "accessory";

export interface OutfitItem {
  slot: SlotName;
  productId: number;
  productName: string;
  productPrice: number;
  category: string;
  media: string[];
  glbUrl?: string;
  glbAssetUrl?: string;
  usdzUrl?: string;
  riggedGlbUrl?: string;
}

export interface OutfitDetail {
  id: number;
  items: OutfitItem[];
  explanation: string;
}

export interface ManualOutfitRequest {
  slots: Record<string, number>;
  note?: string;
  occasion?: string;
}
// ── Promotion types ───────────────────────────────────────────────────────────

export type PromotionSlotType = "FEATURED" | "SPONSORED";

export interface PromotionResponse {
  id: number;
  productId: number;
  productName: string;
  slotType: PromotionSlotType;
  weight: number;
  startAt: string;
  endAt: string;
  active: boolean;
}

export interface CreatePromotionRequest {
  productId: number;
  slotType: PromotionSlotType;
  weight: number;
  startAt: string;
  endAt: string;
}

export type UpdatePromotionRequest = Partial<CreatePromotionRequest>;

export const promotions = {
  list: () => api.get<PromotionResponse[]>("/api/promotions"),
  create: (data: CreatePromotionRequest) => api.post<PromotionResponse>("/api/promotions", data),
  update: (id: number, data: UpdatePromotionRequest) => api.put<PromotionResponse>(`/api/promotions/${id}`, data),
  delete: (id: number) => api.delete(`/api/promotions/${id}`),
};

// ── Chat + Weather types & helpers ──────────────────────────────────────────────

export interface ChatSession {
  id: number;
  status: "ACTIVE" | "COMPLETED";
  createdAt: string;
}

/** Outfit payload returned inline in a chat message (id is null until persisted). */
export interface OutfitResponse {
  id: number | null;
  items: OutfitItem[];
  explanation: string;
  createdAt?: string;
}

export interface ChatMessage {
  id: number;
  role: "USER" | "ASSISTANT";
  content: string;
  outfit?: OutfitResponse | null;
  outfitRecommendationId?: number | null;
  suggestions?: string[];
  createdAt: string;
}

export interface Weather {
  temperatureC: number | null;
  feelsLikeC: number | null;
  condition: string | null;
  available: boolean;
}

export const chat = {
  listSessions: (signal?: AbortSignal) => api.get<ChatSession[]>("/api/chat/sessions", { signal }),
  createSession: () => api.post<ChatSession>("/api/chat/sessions"),
  getMessages: (sessionId: number, signal?: AbortSignal) =>
    api.get<ChatMessage[]>(`/api/chat/sessions/${sessionId}/messages`, { signal }),
  sendMessage: (sessionId: number, content: string) =>
    api.post<ChatMessage>(`/api/chat/sessions/${sessionId}/messages`, { content }),
  getWeather: (signal?: AbortSignal) => api.get<Weather>("/api/chat/weather", { signal }),
};

// Canonical helper lives on `chat` (the endpoint is /api/chat/weather); this
// namespaced alias delegates so there is only one implementation to maintain.
export const weather = {
  get: (signal?: AbortSignal) => chat.getWeather(signal),
};
