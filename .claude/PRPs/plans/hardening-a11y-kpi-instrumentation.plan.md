# Plan: Hardening, A11y & KPI Instrumentation (Phase 9)

## Summary
Make the IYAE relaunch production-grade, accessible, and measurable across five orthogonal hardening surfaces: (1) **turn email verification ON** for production and actually gate login (today the flag is overridden off and login never checks it); (2) **make per-IP rate limiting effective behind Nginx** by adding trusted-proxy CIDR config + env wiring (the filter already parses X-Forwarded-For but has no config, so all clients collapse into one bucket); (3) bring the web app — **including the 3D/AR viewer, which has zero a11y today** — to **WCAG 2.1 AA** (skip-link + landmarks, keyboard/announced 3D controls, form error association, 44px targets, automated axe scans); (4) add **A/B-cohort KPI instrumentation** (conversion / return / retention / size-bracketing) as a greenfield events+cohorts vertical slice queryable by cohort; and (5) audit and **keep checkout dark-pattern-free** (it is clean today — this locks it in with tests). This is additive hardening on a production-grade, well-tested stack — no rewrite.

## User Story
As **the IYAE founder relaunching an independent company**, I want verified accounts, correct security posture behind my reverse proxy, an accessible experience for every shopper (including on the hero 3D try-on), and KPIs I can slice by experiment cohort from day one, so that the relaunch is trustworthy, compliant, measurable, and free of manipulative checkout patterns.

## Problem → Solution
**Current state:** Email verification is fully built but **disabled in every runtime profile** (`application-prod.yml:7` overrides the base `true` to `false`) and **login never checks `emailVerified`** — only ChatService (soft 200) and CheckoutController (403) gate on it. The `RateLimitFilter` already does trusted-proxy XFF parsing but **no `app.rate-limit.trusted-proxies` exists in any YAML and no env var wires it in prod**, so behind Nginx every request resolves to the proxy's container IP and shares one bucket; matching is exact-string only (no CIDR) so dynamic Docker bridge IPs can't be pinned. The **entire 3D/AR layer has no accessibility** (no roles, labels, keyboard controls, or announced status), there is **no skip-link and no global `<main>`**, forms have **zero `aria-invalid`/`aria-describedby`**, and there is **no automated a11y testing**. There is **zero product analytics** anywhere — no events, cohorts, conversion/return/retention/size-bracket signals. Checkout is currently free of dark patterns but nothing guards against regressions.
**Desired state:** Production requires verified email (login blocked with a dedicated **403**, plus a resend-verification endpoint); rate limiting keys on the true client IP via a `RateLimitProperties` record with **CIDR** trusted-proxy support wired through `application.yml` + `docker-compose.prod.yml`; the web app passes an automated **axe** scan and manual WCAG 2.1 AA audit including keyboard-operable, announced 3D/AR viewers; a new **`analytics_events` + `cohort_assignments`** schema (V11) with an events/cohorts vertical slice makes **conversion, return, retention, and size-bracket KPIs queryable by cohort**; and a documented dark-pattern audit + e2e assertions lock checkout honesty in. All green against the existing **~336 server / ~222 web / ~292 worker** regression net plus new tests.

## Metadata
- **Complexity**: XL (5 orthogonal workstreams spanning server security, infra/compose, a full web a11y sweep incl. R3F/WebGL, a greenfield analytics subsystem with a new migration + vertical slice, and a checkout audit)
- **Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
- **PRD Phase**: Phase 9 — Hardening, A11y & KPI Instrumentation (cross-cutting; depends only on Phase 1 which is complete; runs alongside Phase 2)
- **Estimated Files**: ~55 (server: 1 migration + ~14 Java new/edit; web: ~22 new/edit incl. 7 viewers; config/infra: ~4; tests: server ~6, web ~6, e2e ~3)
- **Delivery unit**: **Five stacked commits on one branch**, each independently green, because the surfaces are orthogonal and share only the Phase-2 theme:
  - **A** — Email verification ON (server security)
  - **B** — Rate-limit trusted proxies + CIDR (server + infra)
  - **C** — WCAG 2.1 AA incl. 3D viewer (web)
  - **D** — A/B-cohort KPI instrumentation (server + web, greenfield)
  - **E** — Dark-pattern-free checkout audit + guards (web)

Units A, B, D, E are back-loadable in any order; C is the largest and can proceed fully in parallel. D depends on nothing but is the only one adding a migration (V11).

---

## UX Design

### Before
```
┌─ Auth ─────────────────────────────────────────────┐   Verification is cosmetic:
│  register → JWT returned immediately, logged in     │   unverified users use the
│  login  → succeeds even if email NEVER verified     │   whole app; only AI-chat &
│  (no "resend verification" anywhere)                │   checkout nudge them.
└─────────────────────────────────────────────────────┘

┌─ 3D Try-On (hero) ─────────────────────────────────┐   Mouse/touch ONLY. A keyboard
│   ╭───────────────╮   "Drag to rotate ·            │   or screen-reader user gets a
│   │   <Canvas>    │    Scroll to zoom ·            │   silent, unlabeled <canvas>,
│   │  (no role,    │    Right-click to pan"         │   no announced load/error, and
│   │   no label)   │   [AR placement = tap only]    │   an AR overlay with no focus
│   ╰───────────────╯                                 │   trap / Escape.
└─────────────────────────────────────────────────────┘

┌─ Rate limiting behind Nginx ───────────────────────┐   remoteAddr == Nginx bridge IP
│  client → Nginx → server.getRemoteAddr()=172.x.x.x │   ⇒ ALL clients share ONE bucket
│  (app.rate-limit.trusted-proxies is UNSET)         │   ⇒ per-IP limiting ineffective.
└─────────────────────────────────────────────────────┘

KPIs: none. No events, no cohorts, no conversion/return/retention/size data.
Checkout: honest today, but unguarded against future dark patterns.
```

### After
```
┌─ Auth ─────────────────────────────────────────────┐   Prod requires verification;
│  login (prod, unverified) → 403 EMAIL_NOT_VERIFIED  │   login blocked; dedicated
│  POST /api/auth/resend-verification → 200 (generic) │   403 + resend endpoint;
│  register still returns JWT (verify to unlock)      │   dev/test unchanged.
└─────────────────────────────────────────────────────┘

┌─ 3D Try-On (hero, accessible) ─────────────────────┐   role="img"+aria-label describing
│   ╭───────────────╮  ⌨ ← → rotate · +/- zoom       │   the garment; keyboard orbit;
│   │  <Canvas      │  [status: "Loading 3D… 60%"    │   aria-live load/error status;
│   │   role=img    │   announced via aria-live]     │   AR overlay = focus-trapped +
│   │   aria-label> │  [AR: "Place model" BUTTON]    │   Escape; autoRotate respects
│   ╰───────────────╯  Skip-link ⤒ · <main> landmark │   prefers-reduced-motion.
└─────────────────────────────────────────────────────┘

┌─ Rate limiting behind Nginx ───────────────────────┐   trusted-proxies=172.16.0.0/12
│  client 203.0.113.5 → Nginx(172.x) → XFF walk →    │   ⇒ real client IP keys bucket
│  resolveClientIp = 203.0.113.5 (proxy in CIDR)     │   ⇒ per-IP limiting effective.
└─────────────────────────────────────────────────────┘

KPIs: analytics_events + cohort_assignments (V11). Every user deterministically
bucketed to an experiment cohort; conversion (checkout_initiated→order_paid),
return, retention, size-bracket all queryable `GROUP BY cohort`.
Checkout: documented dark-pattern audit + e2e assertions guard honesty.
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Login (prod) | Succeeds unverified | **403 `EMAIL_NOT_VERIFIED`** when `require-email-verification` true | Dev/test keep flag off → unchanged; 3 existing `login_*` tests updated |
| Verification email | Sent once on register, no resend | `POST /api/auth/resend-verification` (generic 200, enumeration-safe) | New endpoint + rate-limit rule 3/60s |
| Any 3D/AR viewer | Silent unlabeled `<canvas>`, mouse-only | `role="img"` + descriptive `aria-label`, keyboard orbit, `aria-live` load/error status | Applies to all 7 viewers |
| AR fullscreen overlay | No focus trap / Escape | Focus-trapped, Escape-to-exit, focus restored | `ARViewer` `fixed inset-0` overlay |
| Landing `TryOnViewer` | `autoRotate` always spins | Gated on `prefers-reduced-motion` | WCAG 2.2.2 |
| Every page | No skip-link, often no `<main>` | Skip-to-content link + global `<main id="main-content">` | Added in `app/layout.tsx` |
| Forms (login/register/checkout/product) | Errors not associated | `aria-invalid` + `aria-describedby` on invalid fields | WCAG 3.3.1/4.1.3 |
| Icon buttons | 36px (`h-9 w-9`) | ≥44px target (`size:icon` → `h-11 w-11` or padding) | WCAG 2.5.8 |
| Checkout | Honest, unguarded | Honest, **documented + e2e-asserted** (no pre-checked, no fake urgency, itemized total) | No behavior change, adds guards |
| (Instrumentation) | Nothing tracked | Client emits `view/add_to_cart/checkout_initiated/order_paid`; server emits authoritative funnel events | Non-blocking, best-effort |

---

## Mandatory Reading

Files that MUST be read before implementing (grouped by delivery unit).

| Priority | File | Lines | Why |
|---|---|---|---|
| **A — Email verification** ||||
| P0 | `server/src/main/java/com/iyae/service/AuthService.java` | 27-143, 185-263 | `login` (no gate — add here), `register`, `verifyEmail`, `@Value` TTL fields, token flow |
| P0 | `server/src/main/resources/application-prod.yml` | 1-13 | The `require-email-verification: false` override to remove |
| P0 | `server/src/main/resources/application.yml` | 42-45 | Base `app.auth` block (default `true`) |
| P0 | `server/src/main/java/com/iyae/controller/CheckoutController.java` | 25-37 | Existing 403 verification-gate pattern to mirror for a dedicated exception |
| P1 | `server/src/main/java/com/iyae/exception/GlobalExceptionHandler.java` | 22-76 | Exception→status mappings; add a 403 mapping for `EmailNotVerifiedException` |
| P1 | `server/src/main/java/com/iyae/controller/AuthController.java` | 18-46 | Endpoint style; add `resend-verification` here |
| P1 | `server/src/main/java/com/iyae/service/AuthMailService.java` | 44-124 | `sendVerificationEmail` to reuse for resend |
| P1 | `server/src/main/java/com/iyae/entity/User.java` | 37-45 | `emailVerified`/token fields (`Boolean`, `@Builder.Default`) |
| P0 | `server/src/test/java/com/iyae/service/AuthServiceTest.java` | 42-93, 129-165, 309-328 | Mockito + `ReflectionTestUtils` `@Value` setup; the 3 `login_*` tests that will break |
| P1 | `server/src/test/java/com/iyae/controller/AuthControllerTest.java` | 23-40, 105-118 | `@WebMvcTest` + `WebMvcSecurityConfig` + csrf pattern |
| **B — Rate limiting** ||||
| P0 | `server/src/main/java/com/iyae/config/RateLimitFilter.java` | 17-114 | Full filter; `resolveClientIp` XFF walk (exact-match — add CIDR), `@Value` binding at 41-42 |
| P0 | `server/src/main/java/com/iyae/config/BrandProperties.java` | 1-25 | The `@ConfigurationProperties` record pattern to mirror for `RateLimitProperties` |
| P0 | `server/src/test/java/com/iyae/config/RateLimitFilterTest.java` | 14-29, 181-229 | `createFilter`/`ReflectionTestUtils`/`MockHttpServletRequest` harness + XFF tests |
| P1 | `server/src/main/java/com/iyae/config/SecurityConfig.java` | 24-26, 48-49 | Filter registration order |
| P1 | `server/src/test/java/com/iyae/testsupport/WebMvcSecurityConfig.java` | 48-60 | Pass-through mock filter (keep buildable) |
| P1 | `nginx/conf.d/default.conf` | 27-33, 91-97 | XFF/X-Real-IP set by proxy (both http + https blocks) |
| P1 | `docker-compose.prod.yml` | 23-39, 102-122 | Where to add `RATE_LIMIT_TRUSTED_PROXIES` env |
| P2 | `server/src/main/java/com/iyae/IyaeApplication.java` | 7-9 | `@ConfigurationPropertiesScan` auto-discovery |
| **C — Accessibility** ||||
| P0 | `web/components/SizeSelector.tsx` | all | Exemplar a11y component (role/group/aria-pressed/44px) to mirror |
| P0 | `web/components/PoseSelector.tsx` | 34-72 | Best 3D control (`role="toolbar"`, `aria-pressed`, 44px) to extend with roving-tabindex |
| P0 | `web/components/AvatarViewer.tsx` | 24-34, 219-243 | Primary R3F viewer; `<Canvas>` + `OrbitControls` + `Loader` to make accessible |
| P0 | `web/components/ARViewer.tsx` | 147-158, 208-310 | Fullscreen overlay needing focus trap/Escape; tap-only placement |
| P0 | `web/app/layout.tsx` | all (52) | Add skip-link + global `<main>` here |
| P1 | `web/components/ModelViewer.tsx` | 36-45 | `alt` pattern (only text alt today) |
| P1 | `web/components/home/TryOnViewer.tsx` | 136-163 | `autoRotate` to gate on reduced-motion |
| P1 | `web/components/SmartARViewer.tsx` | 16-47 | Router + Skeleton loading (add `role="status"`) |
| P1 | `web/components/ui/button.tsx` | 7-27 | `size:icon` 36px → 44px; focus ring baseline |
| P1 | `web/components/GenerationStatusBadge.tsx` | 49 | `aria-live="polite"` pattern to reuse for viewer status |
| P1 | `web/app/globals.css` | 3-125, 154-210 | Token contrast pairs + reduced-motion; `@theme inline` dark caveat |
| P0 | `web/__tests__/components/SizeSelector.test.tsx` | all (57) | The only a11y-asserting test — pattern to replicate |
| P1 | `web/e2e/pose-selector.spec.ts` | 22-52 | Role/`aria-pressed` e2e pattern; where to add axe scan |
| **D — KPI instrumentation** ||||
| P0 | `server/src/main/resources/db/migration/V8__community_tables.sql` | all | CREATE-TABLE pattern (PK/timestamps/FK/UNIQUE/INDEX) to mirror for V11 |
| P0 | `server/src/main/java/com/iyae/service/CheckoutService.java` | 65-133, 135-172 | Emission points: order-created (`initiateCheckout`), order-paid (`handleWebhook`) |
| P0 | `server/src/main/java/com/iyae/entity/Order.java` + `service/OrderService.java` + `controller/OrderController.java` + `dto/OrderResponse.java` | all | The vertical-slice conventions to mirror for events/cohorts |
| P0 | `web/lib/api.ts` | 12-62, 137-159 | Typed fetch + JWT + domain-helper pattern for a new `analytics` helper |
| P1 | `web/lib/hooks/useGenerationStatus.ts` | all | Hook shape to mirror for `useTrackEvent`/`useCohort` |
| P1 | `server/src/main/resources/db/migration/V10__cart_item_selected_size.sql` | all | Latest migration (ALTER pattern) + confirms next slot is V11 |
| P1 | `server/src/main/java/com/iyae/entity/enums/OrderStatus.java` | all | Enum-in-`entity/enums` convention for a new `EventType` |
| **E — Checkout audit** ||||
| P0 | `web/app/checkout/page.tsx` | 46-73, 155-192 | Order review + total (no tax/shipping line today); dark-pattern audit surface |
| P1 | `web/app/cart/page.tsx` | 301-307 | Cart→checkout CTA |
| P1 | `web/e2e/checkout-flow.spec.ts` | all | Where to add dark-pattern assertions |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| WCAG 2.1 AA success criteria | https://www.w3.org/WAI/WCAG21/quickref/?levels=aa | Target the specific SCs cited per task: 1.1.1, 1.4.3, 2.1.1, 2.2.2, 2.4.1, 2.4.7, 2.5.8, 3.3.1, 4.1.2, 4.1.3 |
| WAI-ARIA Authoring Practices — toolbar | https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ | Roving-tabindex + arrow-key nav for `PoseSelector` toolbar |
| `@axe-core/playwright` | https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright | `new AxeBuilder({ page }).analyze()` → assert `violations` empty; add to `e2e/` |
| react-three-fiber a11y | https://github.com/pmndrs/drei (`Html`) + APG img role | R3F `<canvas>` has no semantics; wrap container with `role="img"`+`aria-label`; announce load via `aria-live` sibling, not inside `<Html>` |
| Spring `forward-headers-strategy` | https://docs.spring.io/spring-boot/reference/web/servlet.html#web.servlet.embedded-container | Design fork alternative to bespoke XFF parsing; not chosen (no CIDR allowlist) — see Architect |
| Stripe Checkout — honest UX | https://stripe.com/docs/payments/checkout | No forced continuity; itemized amounts; test-mode webhook `checkout.session.completed` |

**External research note:** Rate limiting, email verification, and the analytics slice use only established internal patterns (Spring `@ConfigurationProperties`, Flyway, JPA vertical slice, typed fetch). External research is needed **only** for the a11y unit (WCAG SC specifics + axe wiring) — captured above.

---

## Patterns to Mirror

Actual codebase snippets discovered during exploration. Follow these exactly.

### CONFIG_FLAG_GATE (email verification — the established flag idiom)
```java
// SOURCE: server/src/main/java/com/iyae/controller/CheckoutController.java:25-37
@Value("${app.auth.require-email-verification:true}")   // :true fallback ⇒ unset = enforced
private boolean requireEmailVerification;
// ...
if (requireEmailVerification && !Boolean.TRUE.equals(user.getEmailVerified())) {
    return ResponseEntity.status(403)
        .body(new ErrorResponse("Please verify your email before checkout", 403, Instant.now()));
}
```

### EXCEPTION_TO_STATUS (GlobalExceptionHandler — add a 403 mapping here)
```java
// SOURCE: server/src/main/java/com/iyae/exception/GlobalExceptionHandler.java:37-53
@ExceptionHandler(AccessDeniedException.class)
public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(new ErrorResponse("Access denied", 403, Instant.now()));
}
@ExceptionHandler(IllegalArgumentException.class)   // ← reused for most 400s
public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse(ex.getMessage(), 400, Instant.now()));
}
```

### CONFIGURATION_PROPERTIES_RECORD (mirror for RateLimitProperties, AnalyticsProperties)
```java
// SOURCE: server/src/main/java/com/iyae/config/BrandProperties.java:19-25
@ConfigurationProperties("app.brand")           // auto-discovered by @ConfigurationPropertiesScan
public record BrandProperties(                  // camelCase component ↔ kebab-case YAML key
        String domain,
        String serviceId,
        String guestEmail
) {}
```

### RATE_LIMIT_IP_RESOLUTION (extend this with CIDR — exact-match today)
```java
// SOURCE: server/src/main/java/com/iyae/config/RateLimitFilter.java:87-114 (abridged)
private String resolveClientIp(HttpServletRequest request) {
    if (trustedProxies == null || trustedProxies.isBlank()) return request.getRemoteAddr();
    Set<String> trusted = /* split(",") trim */ ;
    String remoteAddr = request.getRemoteAddr();
    if (!trusted.contains(remoteAddr)) return remoteAddr;      // ← contains() = exact; ADD CIDR
    String xff = request.getHeader("X-Forwarded-For");
    if (xff == null || xff.isBlank()) return remoteAddr;
    String[] ips = xff.split(",");
    for (int i = ips.length - 1; i >= 0; i--) {               // walk right→left, skip proxies
        String ip = ips[i].trim();
        if (!trusted.contains(ip)) return ip;                 // ← same, needs CIDR
    }
    return remoteAddr;
}
```

### RATE_LIMIT_TEST_HARNESS (mirror for CIDR tests)
```java
// SOURCE: server/src/test/java/com/iyae/config/RateLimitFilterTest.java:14-29, 181-197
private RateLimitFilter createFilter(String trustedProxies) {
    RateLimitFilter filter = new RateLimitFilter();
    ReflectionTestUtils.setField(filter, "trustedProxies", trustedProxies);
    return filter;
}
private MockHttpServletRequest makeRequest(String method, String uri, String remoteAddr) {
    MockHttpServletRequest req = new MockHttpServletRequest(method, uri);
    req.setRemoteAddr(remoteAddr);
    return req;
}
// @Test: exhaust 5×, assert 6th → assertThat(res.getStatus()).isEqualTo(429);
// XFF: req.addHeader("X-Forwarded-For", "203.0.113.50"); remoteAddr = trusted proxy
```

### MIGRATION_CREATE_TABLE (mirror for V11 analytics tables)
```sql
-- SOURCE: server/src/main/resources/db/migration/V8__community_tables.sql (pattern)
CREATE TABLE post_likes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_post_like UNIQUE (post_id, user_id),
    CONSTRAINT fk_like_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
    CONSTRAINT fk_like_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_post_likes_post ON post_likes (post_id);
```

### ENTITY_SLICE (mirror for AnalyticsEvent / CohortAssignment)
```java
// SOURCE: server/src/main/java/com/iyae/entity/Order.java (conventions)
@Entity @Table(name = "orders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Order {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) private User user;
    @Enumerated(EnumType.STRING) private OrderStatus status;   // enum in entity/enums/
    @Column(columnDefinition = "json") private String itemsSnapshot;
    @CreationTimestamp private Instant createdAt;
    @UpdateTimestamp  private Instant updatedAt;
}
```

### SERVICE_SLICE
```java
// SOURCE: server/src/main/java/com/iyae/service/OrderService.java (conventions)
@Service @RequiredArgsConstructor
public class OrderService {
    private final OrderRepository orderRepository;
    @Transactional(readOnly = true)
    public List<OrderResponse> getOrders(String email) {
        User user = /* resolve from Authentication.getName() */;
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream().map(OrderResponse::from).toList();
    }
}
```

### DTO_RECORD
```java
// SOURCE: server/src/main/java/com/iyae/dto/OrderResponse.java (conventions)
public record OrderResponse(Long id, String status, /* … */) {
    public static OrderResponse from(Order o) { return new OrderResponse(o.getId(), o.getStatus().name(), /* … */); }
}
```

### WEB_API_HELPER (mirror for `api.analytics`)
```ts
// SOURCE: web/lib/api.ts:12-62, 152-159
async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem("clossette_token");           // NOTE: real key, doc says iyae_token (stale)
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 401) { localStorage.removeItem("clossette_token"); location.href = "/login"; }
  if (!res.ok) throw new ApiError(res.status, (await res.json()).message);
  return res.json();
}
export const api = { get, post, put, delete: del };
export const rigging = { getStatus: (id) => api.get(`/api/rigging/${id}`), /* … */ };  // domain helper shape
```

### A11Y_COMPONENT (the exemplar — mirror for viewer controls)
```tsx
// SOURCE: web/components/SizeSelector.tsx:16-29
<div role="group" aria-label="Select a size">
  {sizes.map((size) => (
    <button
      key={size}
      type="button"
      aria-pressed={selectedSize === size}
      disabled={disabled}
      className="min-w-11 min-h-11 …"        // 44×44 WCAG 2.5.8 target
      onClick={() => onSelect(size)}
    >{size}</button>
  ))}
</div>
```

### A11Y_LIVE_STATUS (reuse for viewer load/error announcements)
```tsx
// SOURCE: web/components/GenerationStatusBadge.tsx:49 / RiggingStatusCard.tsx:55
<span role="status" aria-live="polite">{label}</span>
```

### A11Y_COMPONENT_TEST (the only a11y-asserting test — replicate)
```tsx
// SOURCE: web/__tests__/components/SizeSelector.test.tsx (pattern)
const btn = screen.getByRole("button", { name: "M" });
expect(btn).toHaveAttribute("aria-pressed", "true");
```

### E2E_ROLE_ASSERTION (extend with axe)
```ts
// SOURCE: web/e2e/pose-selector.spec.ts:22-52
await expect(page.getByRole("button", { name: /warrior/i })).toHaveAttribute("aria-pressed", "true");
// ADD: const results = await new AxeBuilder({ page }).analyze(); expect(results.violations).toEqual([]);
```

---

## Files to Change

### Unit A — Email verification ON (server)
| File | Action | Justification |
|---|---|---|
| `server/src/main/resources/application-prod.yml` | UPDATE | Remove the `require-email-verification: false` override (base default `true` takes over) |
| `server/src/main/java/com/iyae/exception/EmailNotVerifiedException.java` | CREATE | Dedicated exception for a clean, consistent **403** (vs reusing `IllegalArgumentException`→400) |
| `server/src/main/java/com/iyae/exception/GlobalExceptionHandler.java` | UPDATE | Map `EmailNotVerifiedException` → 403 |
| `server/src/main/java/com/iyae/service/AuthService.java` | UPDATE | Inject `@Value("${app.auth.require-email-verification:true}")`; block `login` when unverified; add `resendVerification(email)` |
| `server/src/main/java/com/iyae/controller/AuthController.java` | UPDATE | Add `POST /resend-verification` (generic 200) |
| `server/src/main/java/com/iyae/dto/ResendVerificationRequest.java` | CREATE | `record ResendVerificationRequest(@NotNull @Email String email)` |
| `server/src/main/java/com/iyae/config/RateLimitFilter.java` | UPDATE | Add rule `POST /api/auth/resend-verification` → 3/60s |
| `server/src/test/java/com/iyae/service/AuthServiceTest.java` | UPDATE | Set flag via `ReflectionTestUtils`; fix 3 `login_*` tests (set `emailVerified(true)`); add `login_unverified_throws`, `resendVerification_*` |
| `server/src/test/java/com/iyae/controller/AuthControllerTest.java` | UPDATE | Add `resend-verification` 200 test |

### Unit B — Rate-limit trusted proxies + CIDR (server + infra)
| File | Action | Justification |
|---|---|---|
| `server/src/main/java/com/iyae/config/RateLimitProperties.java` | CREATE | `@ConfigurationProperties("app.rate-limit")` record: `List<String> trustedProxies` (IPs+CIDRs), `boolean enabled` |
| `server/src/main/java/com/iyae/config/RateLimitFilter.java` | UPDATE | Inject `RateLimitProperties`; add CIDR matching (`isTrusted(ip)`) alongside exact-match |
| `server/src/main/resources/application.yml` | UPDATE | Add `app.rate-limit.trusted-proxies: ${RATE_LIMIT_TRUSTED_PROXIES:}` |
| `server/src/main/resources/application-prod.yml` | UPDATE | (Optional) default prod CIDR comment |
| `docker-compose.prod.yml` | UPDATE | Add `RATE_LIMIT_TRUSTED_PROXIES` to `server.environment` (Docker bridge CIDR, e.g. `172.16.0.0/12`) |
| `server/src/test/java/com/iyae/config/RateLimitFilterTest.java` | UPDATE | Adapt harness to inject `RateLimitProperties`; add CIDR trusted/untrusted tests |
| `server/src/test/java/com/iyae/testsupport/WebMvcSecurityConfig.java` | VERIFY | Mock filter still buildable (field/prop change is safe) |
| `server/CLAUDE.md` | UPDATE | Fix stale "XFF unimplemented" note |

### Unit C — WCAG 2.1 AA incl. 3D viewer (web)
| File | Action | Justification |
|---|---|---|
| `web/app/layout.tsx` | UPDATE | Add skip-link + global `<main id="main-content">` landmark |
| `web/components/a11y/SkipLink.tsx` | CREATE | Reusable skip-to-content link (visible on focus) |
| `web/components/a11y/useFocusTrap.ts` | CREATE | Focus-trap + Escape + restore hook for custom overlays |
| `web/components/AvatarViewer.tsx` | UPDATE | Wrap `<Canvas>` container `role="img"`+`aria-label`; keyboard orbit; `aria-live` load status |
| `web/components/ARViewer.tsx` | UPDATE | Focus-trap overlay, Escape-to-exit, `role="alert"` on unsupported, keyboard placement path |
| `web/components/ModelViewer.tsx` | UPDATE | Descriptive `alt` from garment name (not generic) |
| `web/components/SmartARViewer.tsx` | UPDATE | Skeleton → `role="status"` + `aria-busy` labeled loader |
| `web/components/DemoOutfitModel.tsx` | UPDATE | Announce fallback via `role="status"` |
| `web/components/home/TryOnViewer.tsx` | UPDATE | Gate `autoRotate` on `prefers-reduced-motion` |
| `web/components/outfits/OutfitBuilderPreview.tsx` | UPDATE | Announce loading/fallback; keyboard hint parity |
| `web/components/PoseSelector.tsx` | UPDATE | Add roving-tabindex + arrow-key nav (APG toolbar) |
| `web/components/ui/button.tsx` | UPDATE | `size:icon` → ≥44px (`h-11 w-11`) |
| `web/lib/hooks/usePrefersReducedMotion.ts` | CREATE | Shared reduced-motion hook |
| Form pages (`login/register/checkout/product`) | UPDATE | Add `aria-invalid` + `aria-describedby` on invalid inputs |
| `web/package.json` | UPDATE | Add `@axe-core/playwright` devDependency |
| `web/e2e/a11y.spec.ts` | CREATE | Axe scans of key routes (home, shop, PDP, cart, checkout, try-on) |
| `web/__tests__/components/AvatarViewer.a11y.test.tsx` | CREATE | Role/label assertions (mirror `SizeSelector.test.tsx`) |
| `web/e2e/pose-selector.spec.ts` | UPDATE | Add arrow-key nav assertions |

### Unit D — A/B-cohort KPI instrumentation (server + web)
| File | Action | Justification |
|---|---|---|
| `server/src/main/resources/db/migration/V11__analytics_events_and_cohorts.sql` | CREATE | `analytics_events` + `cohort_assignments` tables (mirror V8) |
| `server/src/main/java/com/iyae/entity/AnalyticsEvent.java` | CREATE | Event entity (mirror `Order`) |
| `server/src/main/java/com/iyae/entity/CohortAssignment.java` | CREATE | User↔cohort mapping (deterministic, timestamped) |
| `server/src/main/java/com/iyae/entity/enums/EventType.java` | CREATE | `VIEW, ADD_TO_CART, CHECKOUT_INITIATED, ORDER_PAID, ORDER_RETURNED` |
| `server/src/main/java/com/iyae/repository/AnalyticsEventRepository.java` | CREATE | JPA repo + `GROUP BY cohort` aggregate queries |
| `server/src/main/java/com/iyae/repository/CohortAssignmentRepository.java` | CREATE | `findByUserId`, `existsByUserId` |
| `server/src/main/java/com/iyae/service/AnalyticsService.java` | CREATE | `record(event)`, deterministic `assignCohort(user)`, KPI aggregates |
| `server/src/main/java/com/iyae/controller/AnalyticsController.java` | CREATE | `POST /api/events` (auth, best-effort), `GET /api/admin/kpis?groupBy=cohort` (ADMIN — see NOT Building) |
| `server/src/main/java/com/iyae/dto/TrackEventRequest.java` + `KpiSummaryResponse.java` | CREATE | DTO records |
| `server/src/main/java/com/iyae/config/AnalyticsProperties.java` | CREATE | `@ConfigurationProperties("app.analytics")`: cohort names/weights, `enabled` |
| `server/src/main/java/com/iyae/service/CheckoutService.java` | UPDATE | Emit authoritative `CHECKOUT_INITIATED` (`initiateCheckout`) + `ORDER_PAID` (`handleWebhook`) |
| `web/lib/api.ts` | UPDATE | Add `api.analytics.track(payload)` helper |
| `web/lib/hooks/useTrackEvent.ts` | CREATE | Best-effort client emitter (fire-and-forget, never throws) |
| `server/src/test/java/com/iyae/service/AnalyticsServiceTest.java` | CREATE | Deterministic cohort assignment + KPI aggregation |
| `server/src/test/java/com/iyae/controller/AnalyticsControllerTest.java` | CREATE | `POST /api/events` 200, ADMIN gate on KPIs |

### Unit E — Dark-pattern-free checkout audit (web)
| File | Action | Justification |
|---|---|---|
| `docs/guides/checkout-dark-pattern-audit.md` | CREATE | Documented checklist (no pre-checked opt-ins, no fake urgency, itemized totals, honest continuity) with current-state PASS evidence |
| `web/app/checkout/page.tsx` | UPDATE | Ensure total is itemized (add explicit tax/shipping line = `$0.00`/"calculated at fulfillment" rather than silent omission); no default-checked add-ons |
| `web/e2e/checkout-flow.spec.ts` | UPDATE | Assert no pre-checked checkboxes, no countdown/urgency text, total = sum of line items |

## NOT Building

- **New rate-limit *tuning* / per-endpoint limit config** — CIDR trusted-proxy support is the fix; limits stay the hardcoded `RULES` (only add `resend-verification`). A full `RateLimitProperties` limits map is out of scope.
- **`server.forward-headers-strategy` / Nginx `set_real_ip_from` migration** — considered and rejected (see Notes); we keep the app-level CIDR filter.
- **Full analytics dashboard UI** — Unit D ships the *data + API + emission*; the admin KPI **read** endpoint is gated behind the Phase-5 ADMIN role. If ADMIN isn't merged yet, expose `GET /api/admin/kpis` behind the existing owner check and leave the console UI to a later phase. No charts/BI frontend.
- **Third-party analytics SDK** (PostHog/Segment/GA) — first-party events table only; no external vendor, no client SDK, no `dataLayer`.
- **Returns/RMA workflow** — Unit D adds an `ORDER_RETURNED` event type + `GROUP BY cohort` query so return-rate is *computable*, but the actual returns/refund lifecycle (Stripe `charge.refunded`, RMA entity) is **not** built here (belongs with Phase 7/8).
- **Rebuilding shadcn primitives** — `components/ui/*` are CLI-generated; only `button.tsx` target-size is touched, minimally.
- **Fixing the `@theme inline` dark-mode cascade** — we *validate* contrast in both themes and log findings; the structural `@theme inline` refactor is Phase 2's concern (see memory `theme-inline-dark-mode-broken`).
- **A "remember me" / session hardening / MFA** — out of scope; verification + rate-limit only.

---

## Step-by-Step Tasks

> Order within a unit matters; units are independent. Recommended sequence: **A → B → E → C → D** (cheap security wins first, largest a11y sweep and greenfield analytics last). Each unit ends green.

### Unit A — Email verification ON

#### Task A1: Add `EmailNotVerifiedException` + 403 mapping
- **ACTION**: Create the exception and map it in `GlobalExceptionHandler`.
- **IMPLEMENT**: `public class EmailNotVerifiedException extends RuntimeException { public EmailNotVerifiedException(String m){ super(m); } }` in `com.iyae.exception`. Add `@ExceptionHandler(EmailNotVerifiedException.class)` returning `ResponseEntity.status(403).body(new ErrorResponse(ex.getMessage(), 403, Instant.now()))`.
- **MIRROR**: EXCEPTION_TO_STATUS.
- **IMPORTS**: `org.springframework.http.HttpStatus`, `java.time.Instant`, `com.iyae.dto.ErrorResponse`.
- **GOTCHA**: Do NOT reuse `IllegalArgumentException` (maps to 400) — a verification block must be 403 to match `CheckoutController`.
- **VALIDATE**: `./gradlew compileJava`.

#### Task A2: Gate `login` on verification
- **ACTION**: Inject the flag into `AuthService` and block unverified login.
- **IMPLEMENT**: Add field `@Value("${app.auth.require-email-verification:true}") private boolean requireEmailVerification;`. In `login`, after the credential check passes, add: `if (requireEmailVerification && !Boolean.TRUE.equals(user.getEmailVerified())) throw new EmailNotVerifiedException("Please verify your email before signing in");`.
- **MIRROR**: CONFIG_FLAG_GATE.
- **GOTCHA**: Place the check **after** the constant-time password match so it doesn't leak whether an email exists (preserve the existing enumeration defense at `AuthService.java:131-143`).
- **VALIDATE**: `./gradlew test --tests AuthServiceTest` — expect the 3 `login_*` tests to fail until A4.

#### Task A3: Resend-verification endpoint
- **ACTION**: Add `resendVerification(email)` to `AuthService` + `POST /resend-verification` to `AuthController` + DTO + rate-limit rule.
- **IMPLEMENT**: Service: look up user by email; if found and not verified, regenerate raw token + hash (reuse `secureTokenService`), set `verificationToken`/`verificationTokenExpiresAt`, save, `authMailService.sendVerificationEmail(...)` wrapped in the same try/catch that swallows `EmailDeliveryException`; **always** return `new MessageResponse("If an account exists and is unverified, we've sent a new verification link")` (enumeration-safe, mirror `forgotPassword`). Controller returns `ResponseEntity.ok(...)`. Add `RateRule("POST", "/api/auth/resend-verification", 3, 60_000)` to `RULES`.
- **MIRROR**: `forgotPassword` (AuthService.java:204-233) + AuthController endpoint style.
- **IMPORTS**: `com.iyae.dto.ResendVerificationRequest`, `jakarta.validation.Valid`.
- **GOTCHA**: Never reveal existence/verification state in the response or status; always 200 generic.
- **VALIDATE**: `./gradlew test --tests AuthServiceTest --tests AuthControllerTest`.

#### Task A4: Fix + extend tests; flip prod flag
- **ACTION**: Update broken login tests, add new coverage, remove prod override.
- **IMPLEMENT**: In `AuthServiceTest.@BeforeEach` set `ReflectionTestUtils.setField(authService, "requireEmailVerification", true)` and build `testUser` with `.emailVerified(true)` for the 3 `login_*` happy-path tests. Add `login_unverified_throwsEmailNotVerified` (asserts `EmailNotVerifiedException`), `resendVerification_unverified_sendsEmail`, `resendVerification_alreadyVerified_isNoOpButGeneric`, `resendVerification_unknownEmail_genericMessage`. In `AuthControllerTest` add `resendVerification_returns200`. Remove `require-email-verification: false` from `application-prod.yml`.
- **MIRROR**: AuthServiceTest setup (`:42-93`), verifyEmail test (`:309-328`).
- **GOTCHA**: `application-dev.yml` keeps `false` so local dev is unaffected; `application-test.yml` has no override → `@Value` default `true`, so any *other* controller/integration test that logs in as an unverified user may now break — grep tests for `.emailVerified(false)` + login and fix. `DataSeeder` already seeds `.emailVerified(true)`.
- **VALIDATE**: `cd server && ./gradlew test` — full suite green.

### Unit B — Rate-limit trusted proxies + CIDR

#### Task B1: `RateLimitProperties` record + CIDR matcher
- **ACTION**: Introduce the config record and CIDR-aware trust check.
- **IMPLEMENT**: `@ConfigurationProperties("app.rate-limit") public record RateLimitProperties(List<String> trustedProxies, boolean enabled) {}`. In `RateLimitFilter`, replace the raw `@Value` field with constructor-injected `RateLimitProperties` (keep `@Component`). Add `private boolean isTrusted(String ip)` that returns true if `ip` equals any entry or falls within any CIDR entry (parse `a.b.c.d/n`, compare via `InetAddress` + bit mask; handle IPv4 first, guard IPv6/parse errors by falling back to exact match). Replace both `trusted.contains(...)` calls in `resolveClientIp` with `isTrusted(...)`.
- **MIRROR**: CONFIGURATION_PROPERTIES_RECORD + RATE_LIMIT_IP_RESOLUTION.
- **IMPORTS**: `java.net.InetAddress`, `java.util.List`, `org.springframework.boot.context.properties.ConfigurationProperties`.
- **GOTCHA**: `RateLimitFilter` is registered via constructor in `SecurityConfig` (field injection there is fine). `WebMvcSecurityConfig` uses `Mockito.mock(RateLimitFilter.class)` — unaffected by constructor change. But `RateLimitFilterTest` calls `new RateLimitFilter()` — update the harness (B3). Keep behavior identical when `trustedProxies` empty (`enabled` default true; empty list ⇒ `getRemoteAddr()`).
- **VALIDATE**: `./gradlew compileJava`.

#### Task B2: Wire config + prod env
- **ACTION**: Add YAML binding + Docker env.
- **IMPLEMENT**: In `application.yml` under `app:` add `rate-limit:\n    enabled: true\n    trusted-proxies: ${RATE_LIMIT_TRUSTED_PROXIES:}` (comma-list → Spring binds to `List<String>`). In `docker-compose.prod.yml` `server.environment` add `RATE_LIMIT_TRUSTED_PROXIES: ${RATE_LIMIT_TRUSTED_PROXIES:-172.16.0.0/12}` (Docker default bridge range; document that operators should pin their actual Nginx subnet).
- **MIRROR**: `${ENV:default}` idiom (application.yml:32).
- **GOTCHA**: Spring binds a comma-separated string OR a YAML list to `List<String>`; the env override must be comma-separated. Verify binding with an integration/context test or a boot smoke check.
- **VALIDATE**: `./gradlew test --tests IyaeApplicationTests` (context loads with new props).

#### Task B3: Tests + doc fix
- **ACTION**: Adapt harness, add CIDR tests, fix stale CLAUDE.md.
- **IMPLEMENT**: Update `createFilter` to build `new RateLimitFilter(new RateLimitProperties(List.of(splitCsv), true))` (or set the field). Keep all 10 existing tests green. Add `xForwardedFor_trustedCidr_parsesClientIp` (`createFilter("172.16.0.0/12")`, `remoteAddr=172.20.0.5`, XFF=`203.0.113.50`, assert client bucketed) and `xForwardedFor_ipOutsideCidr_usesRemoteAddr`. Fix `server/CLAUDE.md` rate-limit note to state XFF/CIDR trusted-proxy parsing is implemented + configured via `app.rate-limit.trusted-proxies`.
- **MIRROR**: RATE_LIMIT_TEST_HARNESS.
- **VALIDATE**: `cd server && ./gradlew test` — full suite green.

### Unit C — WCAG 2.1 AA incl. 3D viewer

#### Task C1: Skip-link + global `<main>` landmark
- **ACTION**: Add a skip-to-content link and a single main landmark app-wide.
- **IMPLEMENT**: `SkipLink.tsx`: an `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 …">Skip to content</a>`. In `app/layout.tsx`, render `<SkipLink />` first inside `<body>` and wrap `{children}` in `<main id="main-content">`. Ensure pages using `PageShell` don't double-nest `<main>` (PageShell already renders one — make PageShell's `<main>` conditional or drop the layout wrapper for those routes; simplest: PageShell renders a `<div>` and the layout owns the sole `<main>`).
- **MIRROR**: A11Y_COMPONENT (sr-only usage in `ui/dialog.tsx:47`).
- **GOTCHA**: Exactly one `<main>` per page (WCAG 1.3.1 / ARIA). Audit `PageShell.tsx` and `app/style-lab/page.tsx` which already render `<main>` — de-duplicate.
- **VALIDATE**: `npm run test`; manually tab from page top → skip-link appears → Enter jumps focus to content.

#### Task C2: Accessible R3F viewer (`AvatarViewer`)
- **ACTION**: Give the primary 3D viewer semantics, keyboard controls, and announced status.
- **IMPLEMENT**: Wrap the `<Canvas>` in a container `<div role="img" aria-label={`3D preview of ${garmentName ?? "your outfit"}`} tabIndex={0}>`. Add a keyboard handler on the container: arrow keys rotate (mutate `OrbitControls` target/azimuth via a ref), `+`/`-` zoom, `Home` reset. Add a visually-hidden `<span role="status" aria-live="polite">` that reflects load progress ("Loading 3D model, 60%") and error ("3D preview unavailable"). Drive it from the drei `useProgress` value instead of only the `<Html>` overlay.
- **MIRROR**: A11Y_COMPONENT + A11Y_LIVE_STATUS.
- **IMPORTS**: `useProgress` from `@react-three/drei`, `usePrefersReducedMotion` (C6).
- **GOTCHA**: `aria-live` region must live in normal DOM (a sibling of `<Canvas>`), NOT inside drei `<Html>` (which portals into the canvas and is unreliable for AT). Keyboard rotation should call `OrbitControls.update()` after mutating.
- **VALIDATE**: `npm run test`; keyboard-rotate the viewer; VoiceOver announces load status.

#### Task C3: `ARViewer` focus trap + Escape + announced errors
- **ACTION**: Make the fullscreen AR overlay keyboard-safe.
- **IMPLEMENT**: Use `useFocusTrap` (C5) on the `fixed inset-0 z-50` overlay: trap Tab within controls, `Escape` calls the existing exit handler, restore focus to the trigger on close. Give `XRNotSupported` `role="alert"`. Add a keyboard path to placement (a "Place model" `<button>` invoking the same logic as `handleCanvasClick`).
- **MIRROR**: `useFocusTrap` (C5); Radix dialog focus semantics (`ui/dialog.tsx`).
- **GOTCHA**: The HUD siblings are `pointer-events-none`; the focusable controls must be in a `pointer-events-auto` subtree or Tab order skips them.
- **VALIDATE**: Enter AR via keyboard, Tab cycles controls only, Escape exits, focus returns.

#### Task C4: Remaining viewers — announced status + descriptive alt + reduced motion
- **ACTION**: Sweep the other 5 viewers.
- **IMPLEMENT**: `ModelViewer` `alt={garmentName ? `3D model of ${garmentName}` : "3D fashion model"}`. `SmartARViewer`/`DemoOutfitModel`/`OutfitBuilderPreview` loading + fallback wrapped in `role="status"` (+ `aria-busy` on loaders). `home/TryOnViewer` `autoRotate={!prefersReducedMotion}`.
- **MIRROR**: A11Y_LIVE_STATUS; `ModelViewer.tsx:39` alt.
- **VALIDATE**: `npm run test`; toggle OS reduce-motion → landing model stops auto-rotating.

#### Task C5: `useFocusTrap` + `usePrefersReducedMotion` hooks
- **ACTION**: Create the shared a11y hooks.
- **IMPLEMENT**: `useFocusTrap(active, containerRef, onEscape)`: on activate, query focusable elements, focus first, wrap Tab/Shift-Tab, handle Escape, restore `document.activeElement` on deactivate. `usePrefersReducedMotion()`: subscribe to `matchMedia("(prefers-reduced-motion: reduce)")`, SSR-safe (default `false`, `"use client"`).
- **MIRROR**: `web/lib/hooks/useGenerationStatus.ts` hook shape (`useState`/`useEffect`/cleanup).
- **GOTCHA**: `matchMedia` is undefined during SSR — guard with `typeof window`. Next.js 16 all-CSR mitigates but keep the guard.
- **VALIDATE**: unit test both hooks (mirror `useDebounce.test.ts`).

#### Task C6: `PoseSelector` roving-tabindex; icon-button target size
- **ACTION**: Complete the toolbar pattern and fix sub-44px targets.
- **IMPLEMENT**: `PoseSelector`: implement roving-tabindex (only the active button `tabIndex={0}`, rest `-1`; ArrowLeft/Right move focus + selection per APG). `ui/button.tsx`: change `size.icon` from `h-9 w-9` to `h-11 w-11` (or add padding to reach 44px) — audit visual regressions on dense toolbars.
- **MIRROR**: WAI-ARIA toolbar APG; A11Y_COMPONENT (44px in `SizeSelector`).
- **GOTCHA**: Enlarging every icon button may shift layouts — spot-check NavBar, cards, chat. If a specific dense cluster can't take 44px, use `size` spacing (invisible hit area) instead of visible growth.
- **VALIDATE**: `npm run test`; arrow-key through poses; measure icon buttons ≥44px.

#### Task C7: Form error association
- **ACTION**: Associate validation errors with inputs on login/register/checkout/product forms.
- **IMPLEMENT**: For each field with an error, set `aria-invalid={!!error}` and `aria-describedby={error ? `${id}-error` : undefined}`, and give the error text `id={`${id}-error`}` + `role="alert"`.
- **MIRROR**: A11Y_LIVE_STATUS; existing `aria-live` badges.
- **VALIDATE**: submit an invalid form; screen reader announces the field error; axe (C8) reports no `label`/`aria` violations.

#### Task C8: Automated axe scans + a11y component test
- **ACTION**: Add `@axe-core/playwright` e2e scans and a viewer component test.
- **IMPLEMENT**: `npm i -D @axe-core/playwright`. `e2e/a11y.spec.ts`: for each of `/`, `/products`, `/products/[id]`, `/cart`, `/checkout`, `/outfits/[id]` (try-on) — `const results = await new AxeBuilder({ page }).analyze(); expect(results.violations).toEqual([])` (or filter to serious/critical initially, with a tracked TODO for moderate). `AvatarViewer.a11y.test.tsx`: assert `getByRole("img", { name: /3D preview/ })` and status region presence. Add arrow-key assertions to `pose-selector.spec.ts`.
- **MIRROR**: E2E_ROLE_ASSERTION; A11Y_COMPONENT_TEST.
- **GOTCHA**: axe on 3D routes needs the 15s viewer-mount wait already used in `pose-selector.spec.ts:22`. Playwright needs a running dev server + API (no auto webServer) — document in the spec header.
- **VALIDATE**: `npm run test`; `npm run test:e2e -- a11y.spec.ts` with dev server up → zero serious/critical violations.

### Unit D — A/B-cohort KPI instrumentation

#### Task D1: V11 migration
- **ACTION**: Create the analytics schema.
- **IMPLEMENT**: `V11__analytics_events_and_cohorts.sql`. `cohort_assignments(id PK, user_id BIGINT NOT NULL, cohort VARCHAR(64) NOT NULL, assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE uk_cohort_user (user_id), FK → users ON DELETE CASCADE)`. `analytics_events(id PK, user_id BIGINT NULL, cohort VARCHAR(64) NULL, event_type VARCHAR(32) NOT NULL, product_id BIGINT NULL, order_id BIGINT NULL, size_bracket VARCHAR(16) NULL, metadata JSON NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`. Indexes: `idx_events_cohort_type (cohort, event_type)`, `idx_events_created (created_at)`, `idx_events_user (user_id)`.
- **MIRROR**: MIGRATION_CREATE_TABLE (V8).
- **GOTCHA**: `user_id` nullable on events (anonymous views) but FK still `ON DELETE CASCADE` when set — use `NULL` allowed FK. Confirm V11 is the next free slot (latest is V10).
- **VALIDATE**: `./gradlew flywayValidate` (or boot with `SPRING_PROFILES_ACTIVE` dev against a scratch DB); Hibernate `ddl-auto: validate` passes at boot.

#### Task D2: Entities + enum + repositories
- **ACTION**: Build the JPA layer.
- **IMPLEMENT**: `EventType` enum (`entity/enums`). `AnalyticsEvent` + `CohortAssignment` entities (mirror `Order` conventions; `@Enumerated(STRING)` for `EventType`; JSON `metadata` as `String columnDefinition="json"`). `AnalyticsEventRepository extends JpaRepository<AnalyticsEvent, Long>` with `@Query` aggregates: conversion (`count CHECKOUT_INITIATED` vs `ORDER_PAID` grouped by cohort), size-bracket counts grouped by cohort. `CohortAssignmentRepository` with `findByUserId`, `existsByUserId`.
- **MIRROR**: ENTITY_SLICE, `OrderRepository` derived queries.
- **VALIDATE**: `./gradlew compileJava`.

#### Task D3: `AnalyticsService` + `AnalyticsProperties`
- **ACTION**: Recording, deterministic cohorting, KPI aggregation.
- **IMPLEMENT**: `AnalyticsProperties` `@ConfigurationProperties("app.analytics")` (`List<String> cohorts` default `["control","variant"]`, `boolean enabled` default true). `AnalyticsService`: `record(userId, type, ...)` persists an event stamped with the user's cohort; `assignCohort(userId)` → deterministic bucket = `cohorts.get(Math.floorMod(Long.hashCode(userId), cohorts.size()))`, persisted once (idempotent via `existsByUserId`); `kpisByCohort()` → `KpiSummaryResponse`. All wrapped so recording never throws into the caller (log + swallow).
- **MIRROR**: SERVICE_SLICE + CONFIGURATION_PROPERTIES_RECORD.
- **GOTCHA**: Deterministic cohorting must be stable across restarts (hash of `userId`, not random) so cohorts are reproducible — the whole point of "queryable by cohort." Recording must be best-effort: a failed insert must not break checkout.
- **VALIDATE**: `./gradlew test --tests AnalyticsServiceTest`.

#### Task D4: `AnalyticsController` + DTOs + emission points
- **ACTION**: Expose the API and emit authoritative server events.
- **IMPLEMENT**: `TrackEventRequest(String type, Long productId, String sizeBracket, Map<String,Object> metadata)`, `KpiSummaryResponse(...)`. `AnalyticsController`: `POST /api/events` (auth; resolves user; calls `analyticsService.record(...)`; returns 202/200), `GET /api/admin/kpis` (ADMIN-gated — see NOT Building; if ADMIN role from Phase 5 isn't merged, gate on owner). In `CheckoutService.initiateCheckout` after order creation (`:114-122`) emit `CHECKOUT_INITIATED` (with size bracket from `ItemSnapshot.selectedSize`); in `handleWebhook` on `checkout.session.completed` (`:166-169`) emit `ORDER_PAID`. Inject `AnalyticsService` into `CheckoutService`.
- **MIRROR**: DTO_RECORD + OrderController style.
- **GOTCHA**: `POST /api/events` should be rate-limit-exempt or generously limited (high-volume) — do NOT add it to `RULES`. Server-side emission is authoritative for conversion (client events are advisory). Keep webhook idempotency intact (don't double-emit on redelivered webhooks — guard on the existing idempotency check at `:154-157`).
- **VALIDATE**: `./gradlew test --tests AnalyticsControllerTest --tests CheckoutServiceTest`.

#### Task D5: Web emitter
- **ACTION**: Client-side best-effort event helper + hook.
- **IMPLEMENT**: In `web/lib/api.ts` add `export const analytics = { track: (payload) => api.post("/api/events", payload).catch(() => {}) }` (never throws). `useTrackEvent.ts`: returns a memoized `track(type, props)` that calls `analytics.track` — fire-and-forget. Wire minimal client events: PDP view, add-to-cart, checkout-initiated (client mirror; server is authoritative).
- **MIRROR**: WEB_API_HELPER + `useGenerationStatus` hook shape.
- **GOTCHA**: Must never block UI or surface errors; `.catch(()=>{})`. Respect the stale-doc token key note (`clossette_token`).
- **VALIDATE**: `npm run test`; network tab shows fire-and-forget `POST /api/events`; failures are silent.

### Unit E — Dark-pattern-free checkout audit

#### Task E1: Document the audit + PASS evidence
- **ACTION**: Write the checklist and record current-state findings.
- **IMPLEMENT**: `docs/guides/checkout-dark-pattern-audit.md` covering: no pre-checked opt-ins/add-ons, no forced continuity/subscription, no fake scarcity/countdown, no hidden fees (itemized total), no confirmshaming, clear terms. Cite `checkout/page.tsx:46-54` (plain sum), `:190-192` (plain terms), `:155-175` (clearly-labeled AI section) as current PASS evidence.
- **VALIDATE**: peer-readable checklist; each item maps to a file:line.

#### Task E2: Itemize totals + guard
- **ACTION**: Make the total honest and explicit.
- **IMPLEMENT**: In `checkout/page.tsx`, render an itemized summary: subtotal, plus an explicit tax and shipping line (show `$0.00` or "calculated at fulfillment" rather than silently omitting — avoids the "hidden fee" pattern), then total. Confirm no checkbox defaults to checked.
- **MIRROR**: existing total block (`:46-54`).
- **GOTCHA**: Server currently charges item subtotal only (no tax/shipping in `CheckoutService`); if you display a non-zero tax/shipping you must also add it server-side — for now display `$0.00`/"calculated later" to stay truthful without a pricing change (that pricing work is out of scope).
- **VALIDATE**: manual review; total displayed == amount charged.

#### Task E3: e2e dark-pattern assertions
- **ACTION**: Lock honesty in with tests.
- **IMPLEMENT**: In `checkout-flow.spec.ts` add assertions: no `input[type=checkbox]:checked` by default; no elements matching `/only \d+ left|hurry|expires in|\d+:\d+/i` urgency copy; displayed total equals the sum of line items.
- **MIRROR**: `e2e/checkout-flow.spec.ts` existing structure.
- **VALIDATE**: `npm run test:e2e -- checkout-flow.spec.ts`.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `login_unverified_throwsEmailNotVerified` | valid creds, `emailVerified=false`, flag on | throws `EmailNotVerifiedException` (→403) | Yes |
| `login_verified_succeeds` | valid creds, `emailVerified=true` | returns JWT | No |
| `login_unverified_flagOff_succeeds` | flag off (dev/test) | returns JWT | Yes |
| `resendVerification_unknownEmail_genericMessage` | non-existent email | 200 generic, no email sent | Yes (enumeration) |
| `resendVerification_alreadyVerified_noEmail` | verified user | 200 generic, no email | Yes |
| `xForwardedFor_trustedCidr_parsesClientIp` | proxy in `172.16.0.0/12`, XFF client | client IP keys bucket → 429 on client | Yes |
| `xForwardedFor_ipOutsideCidr_usesRemoteAddr` | proxy outside CIDR | XFF ignored, remoteAddr used | Yes |
| `assignCohort_isDeterministic` | same userId twice | same cohort both times | Yes |
| `assignCohort_idempotent` | assign twice | one row (`existsByUserId`) | Yes |
| `kpisByCohort_conversion` | 2 initiated, 1 paid in cohort A | conversion 0.5 for A | No |
| `record_failure_swallowed` | repo throws | caller unaffected, logged | Yes |
| `AvatarViewer` a11y | render | `role="img"` + label + status region present | No |
| `usePrefersReducedMotion` | mql matches | returns true, SSR-safe | Yes |

### Edge Cases Checklist
- [ ] Empty `trusted-proxies` → behaves exactly as today (`getRemoteAddr`)
- [ ] Malformed CIDR entry → falls back to exact match, no crash
- [ ] IPv6 remoteAddr with IPv4 CIDR config → no false trust, no crash
- [ ] Unverified user hits `/api/chat` and `/api/checkout` → still gated as before (no regression)
- [ ] Anonymous (no JWT) analytics event → `user_id NULL`, still recorded or cleanly rejected
- [ ] Webhook redelivery → `ORDER_PAID` emitted once (idempotent)
- [ ] Reduced-motion OS setting → landing `autoRotate` stops
- [ ] Keyboard-only user → can rotate viewer, operate AR, reach content via skip-link
- [ ] axe scan on all key routes → zero serious/critical violations
- [ ] Dark/light both → `muted-foreground` contrast verified ≥4.5:1 for body text

---

## Validation Commands

### Static Analysis
```bash
cd server && ./gradlew compileJava compileTestJava
cd web && npx tsc --noEmit
```
EXPECT: Zero compile/type errors.

### Unit Tests (per unit)
```bash
cd server && ./gradlew test --tests AuthServiceTest --tests AuthControllerTest        # A
cd server && ./gradlew test --tests RateLimitFilterTest --tests IyaeApplicationTests  # B
cd web && npm run test                                                                # C, D web
cd server && ./gradlew test --tests 'Analytics*' --tests CheckoutServiceTest          # D server
```
EXPECT: All pass.

### Full Test Suite
```bash
cd server && ./gradlew test          # ~336 baseline + new — all green
cd web && npm run test               # ~222 baseline + new — all green
cd worker && pytest                  # 292 — unaffected, sanity only
```
EXPECT: No regressions.

### Database Validation
```bash
cd server && ./gradlew flywayValidate     # or boot dev profile against scratch DB
```
EXPECT: V11 applies cleanly; Hibernate `ddl-auto: validate` passes at boot (entities match schema).

### Browser / A11y Validation
```bash
cd web && npm run dev                 # + server running (dev.sh start)
cd web && npm run test:e2e -- a11y.spec.ts checkout-flow.spec.ts pose-selector.spec.ts
```
EXPECT: Axe zero serious/critical; checkout assertions pass; keyboard nav works.

### Manual Validation
- [ ] **A**: In a prod-profile boot, register → login fails 403 until `POST /verify-email`; resend works; dev login unaffected.
- [ ] **B**: With `RATE_LIMIT_TRUSTED_PROXIES=172.16.0.0/12`, two different real client IPs behind Nginx get **separate** buckets (one hitting 429 doesn't block the other).
- [ ] **C**: Tab from top → skip-link → content; keyboard-rotate `AvatarViewer`; VoiceOver announces "Loading 3D model 60%"; Escape exits AR; reduced-motion stops auto-rotate; all icon buttons ≥44px.
- [ ] **D**: Complete a stub checkout → `analytics_events` has `CHECKOUT_INITIATED` + `ORDER_PAID` rows stamped with the user's cohort; `SELECT cohort, count(*) … GROUP BY cohort` returns data.
- [ ] **E**: Checkout shows itemized total == charged amount; no pre-checked boxes; no urgency copy.

---

## Acceptance Criteria
- [ ] All tasks completed across the 5 units
- [ ] All validation commands pass
- [ ] Prod requires verified email; login blocked with **403** for unverified; resend endpoint live (enumeration-safe)
- [ ] Rate limiting keys on the real client IP behind Nginx via CIDR trusted-proxy config + prod env
- [ ] Automated axe scan passes (no serious/critical) on all key routes; 3D/AR viewers keyboard-operable + announced
- [ ] `analytics_events` + `cohort_assignments` populated; conversion/return/retention/size-bracket **queryable by cohort**
- [ ] Documented checkout dark-pattern audit with PASS evidence + e2e guards
- [ ] Tests written and passing; no type/lint errors; no regressions in ~336/222/292 nets

## Completion Checklist
- [ ] Code follows discovered patterns (config-flag gate, `@ConfigurationProperties` record, vertical slice, a11y exemplar)
- [ ] Error handling matches codebase style (`GlobalExceptionHandler` 403 mapping, enumeration-safe generic messages)
- [ ] Logging via `@Slf4j`; analytics failures logged + swallowed (never break checkout)
- [ ] Tests mirror existing patterns (Mockito+`ReflectionTestUtils`, `@WebMvcTest`+`WebMvcSecurityConfig`, `MockHttpServletRequest`, `SizeSelector.test` a11y, Playwright role/axe)
- [ ] No hardcoded values (trusted proxies, cohorts via config; token key `clossette_token` reused as-is)
- [ ] Docs updated: `server/CLAUDE.md` rate-limit note fixed; checkout audit guide added; PRD Phase 9 → in-progress
- [ ] No unnecessary scope additions (see NOT Building)
- [ ] Self-contained — no codebase searching needed during implementation

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Turning verification on breaks integration/E2E tests that log in as unverified users | High | Med | Grep tests for `.emailVerified(false)`+login; keep `application-test.yml` and dev flag off; fix the 3 known `login_*` tests |
| Icon-button 44px enlargement causes visual regressions | Med | Low | Spot-check dense clusters (NavBar/cards/chat); use invisible hit-area padding where visible growth breaks layout |
| CIDR parsing edge cases (IPv6, malformed) | Med | Med | Fallback to exact match on parse failure; unit-test malformed/IPv6; default env to Docker bridge CIDR |
| axe surfaces many pre-existing moderate violations across 30+ routes | High | Med | Scope initial gate to serious/critical; file moderate findings as tracked TODOs; don't block the phase on non-AA-blocking items |
| `@theme inline` dark-mode contrast failures need Phase-2 structural fix | Med | Med | Validate + log contrast; fix values in `globals.css` only; defer structural `@theme inline` change to Phase 2 (memory `theme-inline-dark-mode-broken`) |
| Admin KPI endpoint depends on Phase-5 ADMIN role not yet merged | Med | Low | Gate KPI read on owner check if ADMIN absent; events/cohorts + POST are independent of ADMIN |
| Analytics recording adds checkout latency / failure surface | Low | High | Best-effort, swallow errors, log only; server emission after order persistence, never in the critical charge path |

## Notes
- **Corrects two stale docs discovered during exploration**: (1) `server/CLAUDE.md` claims XFF trusted-proxy parsing is unimplemented — it **is** implemented (the gap is config/CIDR, not code); (2) `web/CLAUDE.md` documents the JWT localStorage key as `iyae_token` but the code uses `clossette_token` (`api.ts:20`) — trust the code, do not "fix" it in this phase.
- **Design fork logged (rate limiting)**: an alternative is `server.forward-headers-strategy: FRAMEWORK` + Nginx `set_real_ip_from`/`real_ip_header`. Rejected because `FRAMEWORK` trusts XFF unconditionally (no allowlist) and Nginx's `realip` module is not currently configured — the app-level CIDR filter gives explicit, testable control with the least infra change.
- **Verification consistency**: today ChatService returns a soft 200 while CheckoutController returns 403. This plan standardizes on **403 via `EmailNotVerifiedException`** for the new login gate; optionally align CheckoutController to throw the same exception (kept minimal here to avoid touching working code — noted for a follow-up).
- **Delivery**: five stacked commits (A–E) on one branch, each independently green; open one draft PR for the phase. Units are orthogonal — if capacity is tight, A + B + E are small high-value security/honesty wins shippable before the larger C and D.
