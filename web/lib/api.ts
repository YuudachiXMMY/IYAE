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

export interface TrackEventPayload {
  type: string;
  productId?: number;
  sizeBracket?: string;
  metadata?: string;
}

/** One pre/post window of the Phase 4 drape-decision funnel. */
export interface FunnelWindow {
  tryOnStarted: number;
  addToCart: number;
  tryOnToCartRate: number;
}

/** Phase 4 pre/post (before-vs-after deploy) drape conversion decision gate. */
export interface DrapeDecisionResponse {
  cutoff: string;
  before: FunnelWindow;
  after: FunnelWindow;
  absoluteLift: number;
  relativeLift: number;
  zScore: number;
  pValue: number;
  significant: boolean;
  recommendation: "INVEST" | "STOP" | "INCONCLUSIVE";
}

/** Per-cohort KPI row from GET /api/admin/kpis. */
export interface CohortKpi {
  cohort: string;
  views: number;
  tryOnStarted: number;
  addToCart: number;
  checkoutInitiated: number;
  ordersPaid: number;
  ordersReturned: number;
  conversionRate: number;
  returnRate: number;
}

export interface SizeBracketKpi {
  cohort: string;
  sizeBracket: string;
  paidCount: number;
}

export interface KpiSummaryResponse {
  cohorts: CohortKpi[];
  sizeBrackets: SizeBracketKpi[];
}

/**
 * Best-effort, fire-and-forget analytics emitter. Never throws or blocks the UI —
 * the server treats client events as advisory; server-side emission is authoritative.
 */
export const analytics = {
  track: (payload: TrackEventPayload): void => {
    void api.post("/api/events", payload).catch(() => {
      /* swallow — analytics must never surface an error to the user */
    });
  },

  // ── ADMIN reads (unlike track, these THROW ApiError — callers must try/catch) ──
  kpis: () => api.get<KpiSummaryResponse>("/api/admin/kpis"),
  drapeDecision: (cutoff?: string) =>
    api.get<DrapeDecisionResponse>(
      `/api/admin/kpis/drape-decision${cutoff ? `?cutoff=${encodeURIComponent(cutoff)}` : ""}`,
    ),
};

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
  role: "BUYER" | "DESIGNER" | "ADMIN";
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

// Canonical avatar-status response shape. Defined here so `@/lib/api` owns every
// API response type; the `useAvatarStatus` hook imports it from this module.
export interface AvatarStatus {
  status: "NONE" | "PENDING" | "RUNNING" | "READY" | "FAILED";
  glbUrl: string | null;
  errorMessage: string | null;
  retryCount: number;
}

export const auth = {
  register: (data: RegisterRequest) => api.post<{ token: string; user: UserResponse }>("/api/auth/register", data),
  login: (email: string, password: string) => api.post<{ token: string; user: UserResponse }>("/api/auth/login", { email, password }),
  me: () => api.get<UserResponse>("/api/auth/me"),
  updateProfile: (data: UpdateProfileRequest) => api.put<UserResponse>("/api/auth/me", data),
  // permitAll + rate-limited; returns a generic (enumeration-safe) message — treat any 2xx as success.
  resendVerification: (email: string) =>
    api.post<{ message: string }>("/api/auth/resend-verification", { email }),
};

export const avatar = {
  getStatus: (signal?: AbortSignal) => api.get<AvatarStatus>("/api/avatar/status", { signal }),
  generate: () => api.post<AvatarStatus>("/api/avatar/generate"),
  getAvatar: (signal?: AbortSignal) => api.get<AvatarResponse>("/api/avatar", { signal }),
  delete: () => api.delete<void>("/api/avatar"),
};

// ── Size recommendation ─────────────────────────────────────────────────────────

export interface SizeRecommendationResponse {
  recommendedSize: string | null;
  basis: "MEASUREMENT_CHART" | "SELF_REPORTED" | "NONE";
  confidence: number;
  availableSizes: string[];
}

export const sizing = {
  getRecommendedSize: (productId: number, signal?: AbortSignal) =>
    api.get<SizeRecommendationResponse>(`/api/products/${productId}/recommended-size`, { signal }),
};

// ── Fulfillment: Toronto pickup + multi-carrier shipping (Phase 8) ───────────────

export type FulfillmentMethod = "SHIP" | "PICKUP";

export interface PickupLocation {
  id: number;
  name: string;
  addressLine: string;
  city: string;
  instructions: string | null;
}

export interface ShippingOption {
  carrier: string;
  displayName: string;
  fee: number;
}

export interface CheckoutRequestBody {
  fulfillmentMethod: FulfillmentMethod;
  pickupLocationId?: number | null;
  shippingCarrier?: string | null;
}

/** Public reference reads for the checkout fulfillment selector. */
export const fulfillment = {
  pickupLocations: (signal?: AbortSignal) =>
    api.get<PickupLocation[]>("/api/fulfillment/pickup-locations", { signal }),
  shippingOptions: (signal?: AbortSignal) =>
    api.get<ShippingOption[]>("/api/fulfillment/shipping-options", { signal }),
};

// ── Resale / Circular / Trade-in (Phase 7) ──────────────────────────────────────

export type ResaleCondition = "NEW_WITH_TAGS" | "EXCELLENT" | "GOOD" | "FAIR";
export type ResaleStatus = "DRAFT" | "LISTED" | "RESERVED" | "SOLD" | "REMOVED";

export interface ResaleListing {
  id: number;
  productId: number;
  productName: string;
  productMedia: string[];
  sellerUsername: string | null;
  sizeLabel: string;
  condition: ResaleCondition;
  askingPrice: number;
  currency: string;
  status: ResaleStatus;
  sellerNote: string | null;
  media: string[];
  createdAt: string;
}

export interface ResaleEligibleItem {
  productId: number;
  productName: string;
  sizeLabel: string;
  productMedia: string[];
  orderId: number;
}

export interface CreateResaleListingPayload {
  productId: number;
  sizeLabel: string;
  condition: ResaleCondition;
  askingPrice: number;
  sellerNote?: string;
  media?: string[];
}

/**
 * Typed client for the resale (pre-loved) API. Browse/get are public; the rest require auth.
 * `checkout` returns the Stripe (or stub) URL to redirect the browser to.
 */
export const resale = {
  browse: (page = 0, size = 20, signal?: AbortSignal) =>
    api.get<Paged<ResaleListing>>(`/api/resale/listings?page=${page}&size=${size}`, { signal }),
  get: (id: number, signal?: AbortSignal) =>
    api.get<ResaleListing>(`/api/resale/listings/${id}`, { signal }),
  eligibleItems: (signal?: AbortSignal) =>
    api.get<ResaleEligibleItem[]>("/api/resale/eligible-items", { signal }),
  myListings: (signal?: AbortSignal) =>
    api.get<ResaleListing[]>("/api/resale/my-listings", { signal }),
  create: (payload: CreateResaleListingPayload) =>
    api.post<ResaleListing>("/api/resale/listings", payload),
  remove: (id: number) => api.delete<void>(`/api/resale/listings/${id}`),
  checkout: (id: number) =>
    api.post<{ sessionId: string; url: string }>(`/api/resale/listings/${id}/checkout`),
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

// ── Marketplace: cross-brand sizing ─────────────────────────────────────────────

export interface SizeMeasurement {
  sizeLabel: string;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  lengthCm: number | null;
}

// ── Admin moderation ────────────────────────────────────────────────────────────

export type AdminProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface AdminProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  currency: string;
  status: AdminProductStatus;
  designerDisplayName: string | null;
  designerLocal: boolean;
  designerCity: string | null;
}

export type AdminPostStatus = "ACTIVE" | "ARCHIVED" | "PENDING_DELETE";

export interface AdminPost {
  id: number;
  authorId: number;
  authorName: string | null;
  authorUsername: string | null;
  content: string | null;
  status: AdminPostStatus;
  createdAt: string;
}

export const admin = {
  listProducts: (status?: AdminProductStatus) =>
    api.get<AdminProduct[]>(`/api/admin/products${status ? `?status=${status}` : ""}`),
  setProductStatus: (id: number, status: AdminProductStatus) =>
    api.put<AdminProduct>(`/api/admin/products/${id}/status`, { status }),
  listPosts: (status?: AdminPostStatus) =>
    api.get<AdminPost[]>(`/api/admin/posts${status ? `?status=${status}` : ""}`),
  archivePost: (id: number) => api.put<AdminPost>(`/api/admin/posts/${id}/archive`),
  removePost: (id: number) => api.put<AdminPost>(`/api/admin/posts/${id}/remove`),
  listPromotions: () => api.get<PromotionResponse[]>("/api/admin/promotions"),
  setPromotionSlot: (id: number, slotType: PromotionSlotType) =>
    api.put<PromotionResponse>(`/api/admin/promotions/${id}/slot`, { slotType }),
};

// ── Community: posts + follows (Phase 6) ────────────────────────────────────────

/** Paging envelope mirroring the server `PagedResponse<T>`. */
export interface Paged<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

/** The four server-backed named feeds (`GET /api/posts?feed=`). */
export type CommunityFeedType = "discover" | "following" | "toronto" | "body-confidence";
export type CommunityPostStatus = "ACTIVE" | "ARCHIVED" | "PENDING_DELETE";
export type CommunityReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

/** Server community post. Counts are REAL server aggregates — never fabricated. */
export interface Post {
  id: number;
  userId: number;
  username: string;
  content: string | null;
  mediaUrls: string[];
  status: CommunityPostStatus;
  likeCount: number;
  commentCount: number;
  likedByCurrentUser: boolean;
  createdAt: string;
  city: string | null;
  topic: string | null;
  savedLookId: number | null;
  productIds: string[];
}

export interface Comment {
  id: number;
  postId: number;
  userId: number;
  username: string;
  parentCommentId: number | null;
  content: string;
  createdAt: string;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

/** Redacted user row for follower/following lists — no email/demographics (server-enforced). */
export interface PublicUserSummary {
  id: number;
  username: string | null;
  name: string | null;
  role: "BUYER" | "DESIGNER" | "ADMIN";
  styleAesthetics: string[];
  avatarMode: AvatarMode | null;
  avatarPreset: string | null;
}

export interface PostReport {
  id: number;
  postId: number;
  reporterId: number;
  reporterUsername: string;
  reason: string;
  status: CommunityReportStatus;
  createdAt: string;
}

export interface CreatePostPayload {
  content: string;
  mediaUrls?: string[];
  /** Binds a real saved look (Share-a-Look). */
  savedLookId?: number;
  /** Real product ids the look is wearing. */
  productIds?: string[];
  /** Named-feed topic (e.g. "body-confidence"). */
  topic?: string;
  /** City for the location feed (defaults server-side to the author's city). */
  city?: string;
}

/**
 * Typed client for the server community API. Server ids are numeric (distinct from
 * the string ids used by the localStorage demo layer). `like`/`unlike` both hit the
 * server toggle endpoint (POST/DELETE `/like`).
 */
export const posts = {
  feed: (feed: CommunityFeedType, page = 0, size = 20, signal?: AbortSignal) =>
    api.get<Paged<Post>>(`/api/posts?feed=${feed}&page=${page}&size=${size}`, { signal }),
  byUser: (userId: number, page = 0, size = 20, signal?: AbortSignal) =>
    api.get<Paged<Post>>(`/api/posts/user/${userId}?page=${page}&size=${size}`, { signal }),
  get: (id: number, signal?: AbortSignal) => api.get<Post>(`/api/posts/${id}`, { signal }),
  create: (payload: CreatePostPayload) => api.post<Post>("/api/posts", payload),
  like: (id: number) => api.post<Post>(`/api/posts/${id}/like`),
  unlike: (id: number) => api.delete<Post>(`/api/posts/${id}/like`),
  remove: (id: number) => api.delete<void>(`/api/posts/${id}`),
  comment: (id: number, content: string, parentCommentId?: number) =>
    api.post<Comment>(`/api/posts/${id}/comments`, { content, parentCommentId }),
  listComments: (id: number, page = 0, size = 20, signal?: AbortSignal) =>
    api.get<Paged<Comment>>(`/api/posts/${id}/comments?page=${page}&size=${size}`, { signal }),
  report: (id: number, reason: string) =>
    api.post<PostReport>(`/api/posts/${id}/report`, { reason }),
};

/** Typed client for follow relationships + REAL follower/following counts. */
export const follows = {
  toggle: (userId: number) => api.post<void>(`/api/follows/${userId}`),
  remove: (userId: number) => api.delete<void>(`/api/follows/${userId}`),
  counts: (userId: number, signal?: AbortSignal) =>
    api.get<FollowCounts>(`/api/follows/${userId}/counts`, { signal }),
  status: (userId: number, signal?: AbortSignal) =>
    api.get<{ following: boolean }>(`/api/follows/${userId}/status`, { signal }),
  followers: (userId: number, page = 0, size = 20, signal?: AbortSignal) =>
    api.get<Paged<PublicUserSummary>>(`/api/follows/${userId}/followers?page=${page}&size=${size}`, { signal }),
  following: (userId: number, page = 0, size = 20, signal?: AbortSignal) =>
    api.get<Paged<PublicUserSummary>>(`/api/follows/${userId}/following?page=${page}&size=${size}`, { signal }),
};

// ── Admin: community reports (Phase 6) ──────────────────────────────────────────

export const adminReports = {
  list: (status?: CommunityReportStatus, page = 0, size = 20) =>
    api.get<Paged<PostReport>>(
      `/api/admin/reports?${status ? `status=${status}&` : ""}page=${page}&size=${size}`),
  resolve: (id: number, status: CommunityReportStatus = "RESOLVED", removePost = false) =>
    api.put<PostReport>(`/api/admin/reports/${id}/resolve?status=${status}&removePost=${removePost}`),
  removeComment: (commentId: number) =>
    api.put<void>(`/api/admin/comments/${commentId}/remove`),
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
