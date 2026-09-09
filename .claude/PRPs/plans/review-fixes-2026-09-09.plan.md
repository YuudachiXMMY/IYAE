# Plan: Fix 2026-09-09 Full-Review Findings (F1–F15)

## Summary
Remediate the 15 verified defects from the 2026-09-09 full code review (`review_doc_2026-09-09.md`): 9 HIGH + 6 MEDIUM findings spanning the Next.js web frontend, the Spring Boot server, and the Python worker. Each finding is an independent, well-scoped fix; the plan captures the exact source, the correct fix, and the test to add — so implementation needs no further codebase search.

## User Story
As an IYAE user (and operator), I want the app's ordering, checkout, promotions, settings, chat, and 3D-generation paths to work correctly and securely, so that I don't hit crashes, silent data loss, incorrect charges, or local-file exfiltration.

## Problem → Solution
15 latent bugs — several crash core pages (orders), mischarge/mis-fulfill (checkout, Stripe webhook), leak local files (Meshy), or silently drop user data (settings, chat) → each is fixed to match the reviewed root cause, with a regression test mirroring existing module test patterns.

## Metadata
- **Complexity**: XL (spans 3 modules, ~20 files, adds ≥2 Flyway migrations). Split into independently-shippable tiers/PRs (see *Sequencing*).
- **Source PRD**: N/A — input is a code-review report (`review_doc_2026-09-09.md`)
- **PRD Phase**: N/A
- **Estimated Files**: ~20 source + ~15 test

---

## Sequencing (recommended PR split)

The 15 fixes are independent. Ship in tiers so review stays tractable and HIGH-severity fixes land first:

| Tier | Findings | Theme | Rationale |
|---|---|---|---|
| **1 — Crash/charge HIGH** | F1, F5, F6, F7, F8, F9, F14 | Web correctness | User-facing crashes & data loss; no migrations |
| **2 — Payment/auth HIGH** | F2, F4 | Server security | Webhook fulfillment gate + timing-attack hash |
| **3 — Security HIGH** | F3 | Worker + server | Path traversal (only when `MODEL_GENERATION_PROVIDER=meshy`) |
| **4 — Hardening MEDIUM** | F10, F11, F12, F13, F15 | Server robustness | Migrations (F11, F12), config, refactor |

F10/F11/F12 touch JWT claims + `User`/`Order` entities + Flyway migrations — group them so migration version numbers don't collide.

---

## UX Design

Mostly bug fixes to existing surfaces (no new screens). Notable user-visible changes:

### Before → After (per finding)
| Touchpoint | Before | After |
|---|---|---|
| `/orders`, Dashboard→Orders, order detail (F1) | `TypeError: order.items.map is not a function` → error boundary for anyone who placed an order | Order items render (name, qty, price) from parsed snapshot |
| Checkout summary (F5) | Subtotal/total include demo items never charged ($120 shown, $30 charged) | Subtotal reflects only what will be charged; demo items excluded or gated |
| Designer → edit promotion (F6) | Save any promotion edit → 400 | Edit saves successfully |
| Designer → promotions list (F7) | Product name blank, every promotion shows "Inactive" | Product name shown; active state derived from date window |
| Profile → Settings dialog (F8) | Edits on a non-active tab silently discarded on save/reopen | All changed tabs saved (or user warned) |
| Chat → quick-start (F9) | First user message often vanishes (only AI reply remains) | User message persists alongside the reply |
| Dashboard → My Profile stat (F14) | Followers always "0" (contradicts public profile) | Real follower count from `follows.counts` |

Backend-only (no UX): F2, F4, F10, F11, F12, F13, F15, F3.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `server/src/main/java/com/iyae/service/CheckoutService.java` | 69, 167–212, 345–355 | F1 snapshot shape + record; F2/F12 webhook handler |
| P0 | `server/src/main/java/com/iyae/dto/OrderResponse.java` | 10–31 | F1 `items` is raw `String` |
| P0 | `server/src/main/java/com/iyae/service/AuthService.java` | 81–158, 273–301 | F4 dummy hash, F10 register token, F11 reset |
| P0 | `worker/providers/meshy_generator.py` | 168–216 | F3 traversal sink + generate flow |
| P0 | `web/components/dashboard/OrdersPanel.tsx` | 12–27, 64–69 | F1 frontend type + `.map` |
| P0 | `web/app/orders/[id]/page.tsx` | 17–36, 246–271 | F1 second `.map` site + key reads |
| P1 | `web/app/checkout/page.tsx` | 78–100 | F5 subtotal + POST body |
| P1 | `web/components/designer/PromotionForm.tsx` | 103–121, 144 | F6 edit payload (product `<Select>` disabled on edit) |
| P1 | `web/lib/api.ts` | 1–65, 211–215, 337–363, 462–535 | fetch wrapper, `Checkout`/`Promotion`/`Follow` types (F5/F6/F7/F14) |
| P1 | `server/src/main/java/com/iyae/dto/PromotionResponse.java` | 8–15 | F7 server omits `productName`/`active` |
| P1 | `web/components/designer/PromotionList.tsx` | 22–24, 46–63 | F7 undefined reads |
| P1 | `web/components/profile/ProfileSettingsDialog.tsx` | 79, 151–198, 305–309, 351 | F8 tab save + `[open]` reset |
| P1 | `web/app/chat/page.tsx` | 206–227, 255–310 | F9 load effect vs optimistic append |
| P1 | `web/lib/profile-dashboard.ts` | 38–51 | F14 hardcoded `followers = 0` |
| P1 | `server/src/main/java/com/iyae/service/ChatService.java` | 117–210 | F15 tx spans AI HTTP call |
| P1 | `server/src/main/java/com/iyae/security/JwtTokenProvider.java` | 26–35 | F11 JWT claims (only sub/iat/exp) |
| P1 | `server/src/main/java/com/iyae/security/JwtAuthenticationFilter.java` | 24–40 | F10/F11 no verified/version check |
| P1 | `server/src/main/java/com/iyae/config/SecurityConfig.java` | 34–55 | F10 route rules |
| P1 | `server/src/main/java/com/iyae/service/FileStorageService.java` | 19–41 | F13 10MB code limit |
| P1 | `server/src/main/java/com/iyae/config/GlobalExceptionHandler.java` | all | F13 add multipart handler; exception→status map |
| P1 | `server/src/main/java/com/iyae/service/GenerationService.java` | 203–233 | F3 server-side media passthrough |
| P2 | `server/src/main/java/com/iyae/service/ProductService.java` | 148, 187–189 | F3 media persisted unvalidated |
| P2 | `server/src/main/java/com/iyae/entity/Order.java` | 23–78 | F1/F12 entity (no `@Version`) |
| P2 | `worker/main.py` | 30, 43–57 | F3 `output_base_dir` injection |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Stripe `payment_status` | Stripe Checkout Session object | `session.payment_status` ∈ `paid` / `unpaid` / `no_payment_required`; async methods (SEPA, Bacs, Interac) complete as `unpaid` then fire `checkout.session.async_payment_succeeded`. Fulfill only on `paid`/`no_payment_required`. |
| JPA optimistic locking | Jakarta Persistence `@Version` | Adding `@Version Long version` makes concurrent updates throw `OptimisticLockException`; requires a DB column. Alternative: conditional `UPDATE ... WHERE status <> 'PAID'` guarded by affected-row count. |
| Spring multipart | `spring.servlet.multipart.max-file-size` | Default is **1MB**; must be set to match the 10MB code constant. |
| bcrypt format | — | Valid bcrypt is 60 chars: `$2a$` + cost + `$` + 22-char salt + 31-char hash. `BCryptPasswordEncoder.matches()` short-circuits (logs warn, returns false) on malformed hashes — defeating constant-time intent. |

No other external research needed — remaining fixes use established internal patterns.

---

## Patterns to Mirror

### SERVER — DTO record with static factory
```java
// SOURCE: server/.../dto/OrderResponse.java:10-31
public record OrderResponse(Long id, OrderStatus status, BigDecimal totalAmount,
        String items, Instant createdAt, FulfillmentMethod fulfillmentMethod, ...) {
    public static OrderResponse from(Order order, String pickupLocationName) {
        return new OrderResponse(order.getId(), order.getStatus(), order.getTotalAmount(),
                order.getItemsSnapshot(), ...);
    }
}
```

### SERVER — logging + webhook idempotency
```java
// SOURCE: server/.../service/CheckoutService.java:185-196
orderRepository.findByStripeSessionId(session.getId()).ifPresent(order -> {
    if (order.getStatus() == OrderStatus.PAID) {
        log.info("Order {} already PAID, skipping duplicate webhook", order.getId());
        return;
    }
    order.setStatus(OrderStatus.PAID);
    order.setPaymentStatus("PAID");
    orderRepository.save(order);
    log.info("Order {} marked PAID via Stripe session {}", order.getId(), session.getId());
```
Placeholder-style logging (`{}`), never `+` concatenation. Business/validation errors → `throw new IllegalArgumentException(...)` (→ 400 via `GlobalExceptionHandler`).

### SERVER — GlobalExceptionHandler mapping (extend for F13)
```java
// SOURCE: server/.../config/GlobalExceptionHandler.java  (@RestControllerAdvice)
// existing: MethodArgumentNotValid→400, IllegalArgument→400, AccessDenied→403,
//           EmailNotVerified→403, DataIntegrityViolation→409, AIProvider→503, RuntimeException→500
// body shape: new ErrorResponse(message, status, Instant.now())
```

### SERVER — service test (Mockito)
```java
// SOURCE: server/src/test/java/com/iyae/service/OrderServiceTest.java (pattern)
@ExtendWith(MockitoExtension.class)
class XServiceTest {
    @Mock XRepository repo;
    @InjectMocks XService service;
    @Test void doesThing() {
        when(repo.findBy...).thenReturn(Optional.of(entity));
        assertThat(service.call()).isEqualTo(expected);
        // or: assertThatThrownBy(() -> service.call()).isInstanceOf(IllegalArgumentException.class);
    }
}
// Fixtures: testsupport/TestUsers.aBuyer()/aDesigner()/anAdmin(); TestProducts.
```

### SERVER — controller test (WebMvcTest)
```java
// SOURCE: server/src/test/java/com/iyae/controller/OrderControllerTest.java (pattern)
@WebMvcTest(XController.class)
@Import(WebMvcSecurityConfig.class)   // wires REAL SecurityConfig + pass-through filters
class XControllerTest {
    @Autowired MockMvc mvc;
    @MockBean XService service;
    @Test @WithMockUser(username = "buyer@iyae.test")
    void endpoint() throws Exception {
        mvc.perform(get("/api/...")).andExpect(status().isOk())
           .andExpect(jsonPath("$.items").isArray());
    }
    // unauthenticated → status().isForbidden()
}
```

### WEB — api.ts typed fetch + domain client
```ts
// SOURCE: web/lib/api.ts:19-62
// request<T>() injects JWT from localStorage.getItem("clossette_token")  (NOTE: key is "clossette_token", not "iyae_token")
// reads res.text() then JSON.parse; 204 → undefined; !ok → throw new ApiError(status, message); 401 → redirect /login
export const promotions = {
  create: (b: CreatePromotionRequest) => api.post<PromotionResponse>("/api/promotions", b),
  update: (id: number, b: UpdatePromotionRequest) => api.put<PromotionResponse>(`/api/promotions/${id}`, b),
};
export const follows = {
  counts: (userId: number, signal?: AbortSignal) =>
    api.get<FollowCounts>(`/api/follows/${userId}/counts`, { signal }),
};
```

### WEB — error handling + component idiom
```tsx
// SOURCE: web/components/... (convention)
"use client";
const [error, setError] = useState<string | null>(null);
try { /* ... */ } catch (err) {
  setError(err instanceof ApiError ? err.message : "Something went wrong.");
}
// handlers prefixed handle*, wrapped in useCallback; AbortController for cancellable effects
```

### WEB — vitest test structure
```ts
// SOURCE: web/__tests__/lib/api.test.ts:1-70
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const mockFetch = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', mockFetch); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
// makeResponse(body, status) MUST implement .text() (wrapper calls res.text())
// assert via mockFetch.mock.calls[0] → [url, init]; init.method / init.body / init.headers
```

### WORKER — provider style + traversal-fix idiom
```python
# SOURCE: worker/providers/meshy_generator.py
logger = logging.getLogger(__name__)          # module logger, %-style lazy args
# raise stdlib exceptions w/ f-string messages: ValueError (bad input), FileNotFoundError (missing)
# config injected via __init__(output_base_dir=...) from main.py WORKER_OUTPUT_DIR; providers never read env
```

### WORKER — pytest (traversal test belongs in TestResolveImageUrl)
```python
# SOURCE: worker/tests/test_meshy_generator.py:78-81
def test_missing_file_raises_file_not_found(self):
    gen = MeshyGenerator(api_key="k", output_base_dir=str(tmp_path))
    with pytest.raises(FileNotFoundError, match="Image file not found"):
        gen._resolve_image_url("/uploads/products/nonexistent.jpg")
# new test mirrors this with pytest.raises(ValueError, match="...") for "../.." inputs; tmp_path only, no HTTP mock
```

---

## Files to Change

| File | Action | Finding |
|---|---|---|
| `web/components/dashboard/OrdersPanel.tsx` | UPDATE | F1 |
| `web/app/orders/[id]/page.tsx` | UPDATE | F1 |
| `server/.../dto/OrderResponse.java` | UPDATE | F1 (server-side option) |
| `web/app/checkout/page.tsx` | UPDATE | F5 |
| `web/components/designer/PromotionForm.tsx` | UPDATE | F6 (if server requires productId) |
| `server/.../dto/PromotionResponse.java` (+ mapper) | UPDATE | F7 (server-side option) |
| `web/lib/api.ts` | UPDATE | F5/F6/F7/F14 (type alignment) |
| `web/components/designer/PromotionList.tsx` | UPDATE | F7 |
| `web/components/profile/ProfileSettingsDialog.tsx` | UPDATE | F8 |
| `web/app/chat/page.tsx` | UPDATE | F9 |
| `web/lib/profile-dashboard.ts` + call sites | UPDATE | F14 |
| `server/.../service/CheckoutService.java` | UPDATE | F2, F12 |
| `server/.../service/AuthService.java` | UPDATE | F4, F10, F11 |
| `server/.../security/JwtTokenProvider.java` | UPDATE | F11 |
| `server/.../security/JwtAuthenticationFilter.java` | UPDATE | F10/F11 |
| `server/.../entity/User.java` | UPDATE | F11 (add tokenVersion) |
| `server/.../entity/Order.java` | UPDATE | F12 (add @Version) |
| `server/src/main/resources/db/migration/V{N}__*.sql` | CREATE | F11, F12 |
| `server/src/main/resources/application.yml` | UPDATE | F13 |
| `server/.../config/GlobalExceptionHandler.java` | UPDATE | F13 |
| `server/.../service/ChatService.java` | UPDATE | F15 |
| `worker/providers/meshy_generator.py` | UPDATE | F3 |
| `server/.../service/GenerationService.java` | UPDATE | F3 (defense-in-depth) |
| Tests (web `__tests__`, server `src/test`, worker `tests`) | CREATE/UPDATE | all |

## NOT Building
- The "cut but worth following up" items (catalog race, N+1 queries, `useOutfitRiggingStatus` stale overwrite, `GenerationService.retry` attemptCount, JWT-in-localStorage/CSP `unsafe-inline`, guest-avatar enumeration, startup full-table scans, toggle-pill dedup, hardcoded `"IYAE"` string). Track separately.
- The 2 disproven candidates (checkout-success `orders[0]`, resale FK CASCADE→409). No change.
- Broad auth re-architecture (moving JWT off localStorage). F10/F11 do the minimum: verified/version enforcement, not a session-store rewrite.
- Migration-count / feature drift in `CLAUDE.md` (docs say 10 migrations; real count higher). Doc-sync is a separate task.

---

## Step-by-Step Tasks

### TIER 1 — Web crash/charge HIGH

### Task F1: Orders — parse snapshot & align keys
- **ACTION**: Stop treating `order.items` as `OrderItem[]`; parse the JSON snapshot and map keys.
- **IMPLEMENT**: Preferred (server-side, fixes all clients at once): in `OrderResponse`, either annotate `items` with `@com.fasterxml.jackson.annotation.JsonRawValue` (emits the DB JSON as an embedded array, not an escaped string) **or** change the field to a structured `List<ItemSnapshot>` parsed from `itemsSnapshot`. If server-side, also promote `CheckoutService.ItemSnapshot` (currently `private record`) to a shared DTO. Then on the web side type items as `{ productId; productName; quantity; unitPrice: string; selectedSize }[]` and read `productName` + `Number(unitPrice)`. Minimal web-only alternative: keep server as-is, and in both frontend files do `const items = safeParseItems(order.items)` where `safeParseItems` handles `null`/`""`/`"[]"`/malformed → `[]`, then map `productName→name`, `Number(unitPrice)→price`.
- **MIRROR**: DTO record factory pattern; web inline-type + `try/catch`.
- **GOTCHA**: Snapshot keys are `productName`/`unitPrice` (unitPrice is a **String**), NOT `name`/`price`. Empty snapshot is the literal string `"[]"` — `"[]".length === 2` (truthy) and `.map` throws, so guard before mapping. Also flag adjacent bug: frontend reads `order.total` but server returns `totalAmount` → `$NaN`; align in the same change.
- **VALIDATE**: Order with ≥1 item renders names/qty/price; empty order shows "0 items" with no crash. Add web test asserting a JSON-string `items` is parsed; server test asserting `jsonPath("$.items").isArray()` (if server-side fix).

### Task F5: Checkout — exclude demo items from charged total
- **ACTION**: Reconcile displayed subtotal with what checkout actually charges (server-side cart only).
- **IMPLEMENT**: In `checkout/page.tsx`, drop `demoTotal` from `subtotal`/`grandTotal` (charge-accurate), and either (a) hide demo items from the "to be charged" summary with a note, or (b) block placing the order while `demoItems.length > 0` with guidance to remove them. Recommended: (a) — show `serverTotal + fee` as the charged amount; list demo items under a "not included / demo only" caption.
- **MIRROR**: existing `useCart()` usage; inline `error`/notice state.
- **GOTCHA**: The POST body only carries fulfillment fields (`fulfillmentMethod`, `pickupLocationId`/`shippingCarrier`); server computes total from the authenticated cart. Don't try to send amounts. Empty-cart already 400s ("Cart is empty").
- **VALIDATE**: 1 real ($30) + 1 demo ($90) → charged total shows $30 (+fee). Web test on subtotal computation.

### Task F6: Promotion edit — send required productId (or confirm immutable)
- **ACTION**: Make promotion edits not 400.
- **IMPLEMENT**: First confirm the server PUT contract. The finding says `PUT /api/promotions/{id}` reuses `PromotionRequest` with `productId @NotNull` → null fails `@Valid` → 400; and `updatePromotion` ignores `productId`. Two valid fixes: (a) **server** — give update its own DTO without `productId` (or relax `@NotNull`), since product is immutable on edit and the form disables the product `<Select>` when editing; or (b) **web** — include the (unchanged) `editing.productId` in the update payload. Prefer (a): the server should not demand a field it ignores. Verify by reading the promotion controller/`PromotionRequest` before choosing.
- **MIRROR**: server DTO record + `GlobalExceptionHandler` 400 mapping; web `promotions.update`.
- **GOTCHA**: `UpdatePromotionRequest = Partial<CreatePromotionRequest>` so omitting `productId` is already type-legal on the client — the break is purely the server's `@NotNull`.
- **VALIDATE**: Editing weight/dates on an existing promotion returns 200. Server controller test (edit body without productId → 200) or web test.

### Task F7: Promotions list — align type to server DTO
- **ACTION**: Stop reading `productName`/`active` that the server never returns.
- **IMPLEMENT**: Preferred: **server** adds `productName` (join product) and a derived `active` (date-window) to `PromotionResponse` (6→8 fields) + its mapper. Web-only alternative: remove `productName`/`active` from the `PromotionResponse` interface (api.ts:337–346); in `PromotionList.tsx` compute active purely from the date window (line 22–24 already does `startAt<=now<=endAt` — just drop the `&& p.active` clause) and source the product label another way (e.g. keep product list in the form/list, or add server field). Recommended: server-side, since the label needs product data the client lacks.
- **MIRROR**: `PromotionResponse.java` record; api.ts type.
- **GOTCHA**: `isActive` already recomputes from dates; the `&& p.active` (undefined) is the sole breakage of active-state. Don't leave `productName` reads that resolve to `undefined`.
- **VALIDATE**: Active promotions show "Active" and a product name. Web test on `isActive`; server test on DTO fields if server-side.

### Task F8: Settings dialog — persist all dirty tabs
- **ACTION**: Save every changed tab, not just the active one.
- **IMPLEMENT**: Add per-tab dirty tracking: capture a baseline snapshot per tab when the `[open]` effect hydrates (name/username/bio, styles/fits, measurements), compare working state to baseline to derive `dirtyProfile`/`dirtyStyle`/`dirtyMeasurements`. Change `handleActiveTabSave` to await all dirty handlers (`handleSaveProfile`/`handleSaveStyle`/`handleSaveMeasurements`) rather than only the active tab's. Keep the success toast accurate to what saved.
- **MIRROR**: existing `handleSave*` handlers + `sonner` toast; `useCallback`.
- **GOTCHA**: The `[open]` effect (lines 151–198) re-hydrates ALL tab state on every open, so unsaved edits on non-active tabs are lost even if the user never reopens quickly — the fix must save them before that reset can fire. Measurements load async from `/api/body-profile` (404 → treat as empty).
- **VALIDATE**: Edit name on tab A, switch to tab B, Save → name persists (verify via refresh/reopen). Web test on the save dispatcher saving multiple dirty tabs.

### Task F9: Chat quick-start — don't clobber the optimistic first message
- **ACTION**: Prevent the `[activeSessionId]` load effect from wiping the message that quick-start just sent.
- **IMPLEMENT**: Guard the load effect so it does not run (or does not `setMessages([])`) for a session that quick-start is actively populating. Simplest: a `skipLoadForSessionRef` set to the new session id in `handleQuickStart` before `setActiveSessionId`; the effect checks the ref and returns early (clearing it) for that id. Alternatively, have quick-start not rely on the effect at all (create session, then send without triggering a fetch).
- **MIRROR**: existing ref/flag + `useCallback` patterns in the file.
- **GOTCHA**: Effect fires asynchronously after render and unconditionally `setMessages([])` at line 211, then `getMessages` (returns `[]` for a brand-new session) resolves and `setMessages(msgs)` — racing the optimistic append (line 271) and the in-flight send. Only reset for genuine session *switches*, not fresh-created sessions.
- **VALIDATE**: Click a quick-start chip → user message stays visible with the AI reply. E2E (`e2e/ai-stylist.spec.ts`) or component test if feasible.

### Task F14: Dashboard — real follower count
- **ACTION**: Replace hardcoded `followers = 0`.
- **IMPLEMENT**: `getProfileStats` is synchronous + username-keyed; `follows.counts(userId)` is async + userId-keyed — so wire the real count at the **call site** (dashboard/profile component), not inside `getProfileStats`. Fetch `follows.counts(numericUserId, signal)` in the component and merge `followers` into the displayed stats. Requires the numeric user id (public-profile API currently username-only — confirm the id is available on the dashboard's own user; the logged-in user's id is known, so the *own* dashboard is fine).
- **MIRROR**: `follows.counts` client; `AbortController` effect pattern.
- **GOTCHA**: Don't make `getProfileStats` call the API (signature/keying mismatch). `following` is currently local `followedUsernames.length` — decide whether to also switch it to server counts for consistency (recommended: use `follows.counts` for both).
- **VALIDATE**: Dashboard My Profile shows a follower count matching the public profile. Test the merge at the call site.

### TIER 2 — Server payment/auth HIGH

### Task F2: Stripe webhook — gate fulfillment on payment_status
- **ACTION**: Only mark PAID / clear cart / markSold when Stripe reports the session actually paid.
- **IMPLEMENT**: In `CheckoutService.handleWebhook`, before the PAID transition (line 190), require `"paid".equals(session.getPaymentStatus())` (also accept `"no_payment_required"`). For async methods, add handling of `checkout.session.async_payment_succeeded` (fulfill) and `async_payment_failed` (mark failed / leave pending). Keep the existing already-PAID short-circuit.
- **MIRROR**: existing handler structure + placeholder logging.
- **GOTCHA**: `session.getPaymentStatus()` is used **nowhere** today (the two test hits reference the local `Order.getPaymentStatus()` getter, a different method). Async payment methods (SEPA/Bacs/Interac/BNPL) complete `checkout.session.completed` with `payment_status=unpaid` — fulfilling there ships unpaid goods and irreversibly `markSold`s unique resale items.
- **VALIDATE**: Service test: `completed` event with `payment_status=unpaid` → order NOT PAID, cart NOT cleared, `markSold` NOT called; with `paid` → fulfilled. Extend `CheckoutServiceTest`.

### Task F4: Login — real 60-char dummy bcrypt hash
- **ACTION**: Restore constant-time behavior for nonexistent-email logins.
- **IMPLEMENT**: Replace `"$2a$10$dummyhashfortimingattak"` with a real 60-char bcrypt hash (generate once, e.g. `new BCryptPasswordEncoder().encode("timing-guard")`), stored as a `private static final String DUMMY_HASH`. `matches()` then performs full bcrypt work on the nonexistent-user path, equalizing timing.
- **MIRROR**: `private static final` constant convention.
- **GOTCHA**: Valid bcrypt = 60 chars (`$2a$` + cost + `$` + 22 salt + 31 hash). The current string is 29 chars → `matches()` logs a warning and short-circuits false. Login still throws `IllegalArgumentException` → **400** (deliberate enumeration guard) — keep that.
- **VALIDATE**: `AuthServiceTest` login-nonexistent-user and wrong-password both throw `IllegalArgumentException`; assert the encoder's `matches` is actually invoked with the 60-char hash.

### TIER 3 — Worker/server security HIGH

### Task F3: Meshy — reject path traversal + defense-in-depth
- **ACTION**: Prevent `_resolve_image_url` from reading files outside the asset base; validate media upstream.
- **IMPLEMENT**: In `worker/providers/meshy_generator.py:178`, after building `file_path`, resolve and assert containment: `base = os.path.realpath(self.output_base_dir); resolved = os.path.realpath(file_path); if os.path.commonpath([base, resolved]) != base: raise ValueError(f"Image path escapes asset root: {image_url}")`. Keep the existing `os.path.isfile` → `FileNotFoundError`. Defense-in-depth (server): in `GenerationService.extractFirstMediaUrl`/`buildInputPayload`, reject media URLs that aren't `http(s)://` or a `/uploads/products/...`-shaped relative path (no `..`); optionally validate on persistence in `ProductService.createProduct`/`updateProduct`.
- **MIRROR**: worker raise-`ValueError`-with-f-string idiom; server `log.warn` + return-null parse style.
- **GOTCHA**: Only `/`-prefix is stripped today, so both `../../etc/passwd` and `/../../etc/passwd` escape. Must still resolve legitimate `/uploads/products/{uuid}.jpg` under `WORKER_OUTPUT_DIR=/var/iyae/assets`. Sink only active when `MODEL_GENERATION_PROVIDER=meshy`. Guard against symlink escape via `realpath` (not just string prefix).
- **VALIDATE**: New `TestResolveImageUrl` test: `../`-traversal and absolute-escape inputs raise `ValueError`; legitimate `/uploads/products/x.jpg` under `tmp_path` still returns a data URI. Mirror `test_missing_file_raises_file_not_found`.

### TIER 4 — Server hardening MEDIUM

### Task F10: Register — don't hand unverified accounts a full 24h JWT
- **ACTION**: Stop granting full authenticated access before email verification.
- **IMPLEMENT**: Choose one: (a) do NOT return a JWT from `register` (return only `UserResponse`; user logs in after verifying — `login` already blocks unverified when `requireEmailVerification`); or (b) enforce `emailVerified` centrally in `JwtAuthenticationFilter` (load user, reject if unverified for protected routes), or (c) issue a restricted-scope token. Recommended: (a) for smallest blast radius, consistent with `login`'s existing gate. If keeping a token, prefer enforcing verified in the filter so all endpoints are covered (not just `ChatService`'s ad-hoc check).
- **MIRROR**: `AuthResponse`/`UserResponse.from`; `EmailNotVerifiedException` → 403 (already mapped).
- **GOTCHA**: Filter currently authenticates on signature validity alone; `SecurityConfig` has no verified gate; only `ChatService:121` checks verification. Changing register's return shape touches `AuthController` + web `auth.register` consumer — verify the web flow still works (it may expect a token).
- **VALIDATE**: `AuthServiceTest` register no longer returns a usable full-access token (or filter rejects unverified). Coordinate with web `auth-context` test.

### Task F11: Password reset — invalidate outstanding JWTs (tokenVersion)
- **ACTION**: Revoke old sessions on password reset.
- **IMPLEMENT**: Add `token_version INT NOT NULL DEFAULT 0` to `users` (Flyway `V{N}`), `Integer tokenVersion` on `User`. Embed it as a `tokenVersion` claim in `JwtTokenProvider.generateToken` (signature changes from `(email)` to `(email, tokenVersion)`; update callers `register`/`login`). In `JwtAuthenticationFilter`, compare the token's claim to the user's current `tokenVersion`; reject on mismatch. In `resetPassword`, increment `user.tokenVersion` before save.
- **MIRROR**: entity `@Column` + Flyway `V{N}__description.sql`; `JwtTokenProviderTest` round-trips.
- **GOTCHA**: `generateToken(email)` has multiple callers (`register:136`, `login:156`) — update all. `JwtTokenProviderTest` must be updated for the new claim. Precedent: `AuthServiceTest` already handles a migration-style 2-arg `consumeToken`. Coordinate migration version with F12 to avoid `V{N}` collision.
- **VALIDATE**: `JwtTokenProviderTest` claim round-trip; `AuthServiceTest` reset bumps version; filter test rejects a stale-version token.

### Task F12: Webhook idempotency — optimistic lock / conditional update
- **ACTION**: Make concurrent duplicate webhook deliveries safe.
- **IMPLEMENT**: Add `@Version private Long version;` to `Order` + Flyway migration adding a `version` column (default 0), OR use a conditional update repo method `int markPaidIfPending(sessionId)` → `UPDATE orders SET status='PAID' WHERE stripe_session_id=? AND status<>'PAID'` and treat `affected==0` as the idempotency skip (do fulfillment only when `affected==1`). Recommended: conditional-update (no lock contention, atomic guard) — it also naturally single-fires the `ORDER_PAID` analytics event and `markSold`.
- **MIRROR**: `OrderRepository` query methods; `CheckoutService` handler.
- **GOTCHA**: `Order` has no `@Version` today. `markSold`/cart-clear are near-idempotent but the `ORDER_PAID` analytics event is not, and there's no unique constraint on it. Coordinate migration version with F11.
- **VALIDATE**: Service/integration test simulating two concurrent `completed` deliveries → single PAID transition, single `markSold`, single analytics event.

### Task F13: Multipart config + exception handler
- **ACTION**: Allow uploads up to the 10MB code limit and return a clean error above it.
- **IMPLEMENT**: Add to `application.yml`: `spring.servlet.multipart.max-file-size: 10MB` and `max-request-size: 10MB`. Add `@ExceptionHandler(MaxUploadSizeExceededException.class)` to `GlobalExceptionHandler` returning 400 (or 413) with `ErrorResponse`.
- **MIRROR**: existing `GlobalExceptionHandler` handlers + `ErrorResponse(message, status, Instant.now())`.
- **GOTCHA**: Spring default is 1MB → 2–8MB photos currently throw `MaxUploadSizeExceededException` → fall through to `RuntimeException`→500. Tests use `MockMultipartFile` which bypasses the servlet cap, so this won't surface in unit tests — validate manually or with a real multipart integration test.
- **VALIDATE**: Manual: upload a 5MB image → succeeds; >10MB → 400/413 clean message. Add handler unit test.

### Task F15: Chat — move AI HTTP call out of the DB transaction
- **ACTION**: Stop pinning a DB connection across the multi-second AI call.
- **IMPLEMENT**: Split `sendMessage`: (1) short tx persists the user message; (2) AI provider call runs OUTSIDE any transaction; (3) short tx persists assistant message / outfit / session update. Use `TransactionTemplate` (as `CheckoutService` already does with `txTemplate`) or extract `@Transactional` helpers onto a separate bean (self-invocation isn't proxied). Remove `@Transactional` from the method spanning the AI call.
- **MIRROR**: `CheckoutService` `TransactionTemplate` usage; `ChatService` current save calls.
- **GOTCHA**: `outfitService.generateOutfitAnonymous` (line 182) and `persistOutfit` (189) currently run inside the same tx too — keep their writes in the post-AI tx. Preserve the AI-fallback path (lines 158–167) semantics. `ChatServiceTest` (11 tests) will need restructuring.
- **VALIDATE**: `ChatServiceTest` still green after refactor; assert no repository write happens interleaved with the AI mock inside one tx (behavioral: fallback still persists a message). Ideally verify connection isn't held during the AI call.

---

## Testing Strategy

### Unit / regression tests to add or update
| Finding | Test file | Assertion |
|---|---|---|
| F1 | `web/__tests__/...` + `OrderControllerTest`/`OrderServiceTest` | JSON-string items parsed; `$.items` isArray (if server-side) |
| F5 | `web/__tests__/app/checkout...` | subtotal excludes negative-id demo items |
| F6 | `PromotionControllerTest` or web | edit without productId → 200 |
| F7 | web `PromotionList` test / `PromotionResponse` server test | active derived from dates; productName present |
| F8 | web `ProfileSettingsDialog` test | multi-tab dirty save fires all handlers |
| F9 | `e2e/ai-stylist.spec.ts` | quick-start message persists |
| F14 | web dashboard/profile test | followers merged from `follows.counts` |
| F2 | `CheckoutServiceTest` | unpaid `completed` → no fulfillment |
| F4 | `AuthServiceTest` | matches invoked w/ 60-char dummy hash |
| F3 | `worker/tests/test_meshy_generator.py::TestResolveImageUrl` | `../` and absolute-escape → ValueError; legit path OK |
| F10 | `AuthServiceTest` + web `auth-context` | register grants no full-access token |
| F11 | `JwtTokenProviderTest` + `AuthServiceTest` | tokenVersion claim round-trip; reset bumps version |
| F12 | `CheckoutServiceTest` | concurrent duplicate → single transition |
| F13 | `GlobalExceptionHandler` test | MaxUploadSize → 400/413 |
| F15 | `ChatServiceTest` | restructured; fallback still persists |

### Edge Cases Checklist
- [ ] F1: empty snapshot `"[]"`, `null`, malformed JSON
- [ ] F1: `totalAmount` vs `total` → no `$NaN`
- [ ] F3: `/../..` (leading-slash escape), symlink escape, legit `/uploads/products/x.jpg`
- [ ] F5: cart with only demo items, only real items, mixed
- [ ] F2: `payment_status` = paid / unpaid / no_payment_required; async success/failure events
- [ ] F12: two concurrent identical deliveries
- [ ] F8: edit 2 tabs then save; async measurements load race
- [ ] F9: quick-start vs switching to an existing session (must still reset for real switches)
- [ ] F13: 1MB, 5MB, 10MB, >10MB uploads

---

## Validation Commands

### Static Analysis
```bash
cd web && npm run lint && npx tsc --noEmit    # zero type/lint errors
```
EXPECT: Zero errors

### Unit Tests
```bash
cd server && ./gradlew test        # JUnit 5
cd web && npm run test             # Vitest
cd worker && pytest                # pytest
```
EXPECT: All pass (F3/F4/F2 tests new-green; F11/F12 migration + JwtTokenProviderTest updated)

### Database / migration validation
```bash
cd server && ./gradlew flywayValidate   # or bootRun with ddl-auto: validate against MySQL
```
EXPECT: New V{N} migrations (F11 token_version, F12 order version) apply; Hibernate `validate` passes.
NOTE: server tests run on H2 with Flyway off (create-drop) — they will NOT catch entity/DDL drift. Validate migrations against real MySQL (`./dev.sh start`) before merge.

### E2E (F9)
```bash
cd web && npm run test:e2e         # requires dev server + API up
```

### Manual Validation
- [ ] Place an order → open `/orders`, Dashboard→Orders, order detail: items render, no crash
- [ ] Checkout with 1 real + 1 demo item: charged total = real only
- [ ] Edit a promotion: saves; list shows product name + correct Active/Inactive
- [ ] Settings: edit two tabs, save once → both persist
- [ ] Chat quick-start chip: user message stays
- [ ] Upload a 5MB product image (F13) → succeeds
- [ ] (meshy enabled) product media `../../etc/passwd` → generation fails cleanly, no file leaves the box

---

## Acceptance Criteria
- [ ] All 15 findings addressed (or explicitly deferred with rationale)
- [ ] All validation commands pass; migrations validate on MySQL
- [ ] Regression test added per finding, following module test patterns
- [ ] No type/lint errors
- [ ] Matches the before/after UX table

## Completion Checklist
- [ ] Fixes follow discovered patterns (DTO records, `@Slf4j` placeholder logging, api.ts clients, provider ValueError idiom)
- [ ] Error handling matches codebase (IllegalArgumentException→400, ApiError on web)
- [ ] Tests mirror MockitoExtension / WebMvcTest / vitest / pytest structures
- [ ] No hardcoded values (bcrypt hash extracted to constant; sizes to config)
- [ ] Migration versions non-colliding (F11/F12)
- [ ] Contract alignment verified against server DTOs for every web type change

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| F1 server-side `@JsonRawValue` change ripples to all order consumers | Med | Med | Prefer it (fixes all clients); update `OrderControllerTest`/`OrderServiceTest` fixtures passing `"[]"` literals |
| F11 `generateToken` signature change breaks all callers/tests | High | Med | Grep callers (`register`, `login`); update `JwtTokenProviderTest` in same commit |
| F10 changing register's return shape breaks web auth flow | Med | Med | Check web `auth.register`/`auth-context.test` expectations before shipping |
| H2-vs-MySQL test gap hides DDL drift (F11/F12) | High | High | Run `flywayValidate` + bootRun on real MySQL, not just `gradlew test` |
| F13 not caught by unit tests (MockMultipartFile bypasses cap) | High | Low | Manual multipart validation |
| F6/F7 fix location (server vs web) depends on unread promotion controller | Med | Low | Read `PromotionController`/`PromotionRequest` first; plan documents both options |

## Notes
- `web/lib/api.ts` uses `localStorage` key `"clossette_token"` (not `"iyae_token"` as CLAUDE.md states) — pre-existing naming drift; don't "fix" it incidentally, but be aware when touching auth.
- Server tests run on H2 with Flyway disabled (`create-drop`) — structurally blind to real-MySQL entity/DDL mismatch. Any entity/migration change (F11/F12) MUST be validated against MySQL.
- Review reports live untracked under `.claude/reviews/`; this plan follows that convention under `.claude/PRPs/plans/`.
- Confirm the server promotion update DTO (F6) and the promotion list's product-name source (F7) by reading the promotion controller before implementing — both fixes have a server-side and a web-side option, and the plan documents each.
