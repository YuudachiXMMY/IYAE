# Production cutover runbook

What to do, in order, to take a fresh IYAE instance from an empty database to a storefront a
visitor can actually buy from — and how to confirm each step rather than assume it.

Written for B-11: before this existed, a cutover produced 0 products, 0 designer profiles and 0
promotions, with every health signal reporting fine. Containers up, database reachable, nginx
serving, `/products` rendering "No pieces found" for every visitor.

> Launch 1 ships with **payment deliberately off**. `STRIPE_SECRET_KEY` and
> `STRIPE_WEBHOOK_SECRET` are both blank, `POST /api/checkout` answers 503, and the web client
> hides the checkout entry points. That is the supported configuration, not a misconfiguration —
> do not "fix" it by supplying one of the two.

---

## 0. Before you start

Have ready:

- The domain, pointing at the host (A/AAAA record resolving before you run `ssl-init`).
- The operator's email address, on a mailbox you control. This becomes the single ADMIN account.
- A Resend API key and a **verified sender domain**. The default `onboarding@resend.dev` is a
  sandbox that can only deliver to your own Resend account address — see step 2.
- Your starter catalogue: product names, prices, categories, and images.

---

## 1. Configuration

```bash
./prod_deploy.sh setup          # generates .env (owner-only) and a JWT_SECRET
```

Then edit `.env`. The values that decide whether launch day works:

| Variable | Why it matters |
|---|---|
| `ADMIN_BOOTSTRAP_EMAIL` / `_PASSWORD` | The only way to get an administrator. Public registration rejects ADMIN and no migration inserts one. This account also receives a designer profile, so it can author listings. |
| `FRONTEND_BASE_URL` | Goes into every verification and password-reset link. A localhost value points your users at their own machine; `prod_deploy.sh` refuses to start on one. |
| `CORS_ORIGINS` | Empty breaks every state-changing browser request. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | See step 2. |
| `CATALOG_SEED_MANIFEST` | See step 4. |

`prod_deploy.sh up` validates the required set and refuses to start on a bad one. Plain
`docker compose` does not run that check, but `ProductionConfigValidator` fails startup on most
of the same problems — use the script.

---

## 2. Email deliverability — check this by sending, not by reading config

**This is the step most likely to be silently broken on launch day.** Registration succeeds and
returns a usable token even when the verification email fails: `AuthService.register` catches
`EmailDeliveryException` and only logs a warning. Login is gated on `emailVerified` in
production, so the user is left permanently stuck with no in-app error at any point. There is no
metric and no alert — the only trace is a line in the server's stdout.

> **Known gap (finding B-10, not yet fixed):** neither `prod_deploy.sh` nor
> `ProductionConfigValidator` checks `RESEND_API_KEY` or `RESEND_FROM_EMAIL`. Both can be blank,
> or `RESEND_FROM_EMAIL` can be left at the sandbox default, and every preflight passes. Until
> that is fixed, this manual check is the only gate.

1. Set `RESEND_API_KEY`, and set `RESEND_FROM_EMAIL` to an address on a domain **verified in
   Resend**. Not `onboarding@resend.dev`.
2. After the stack is up (step 3), register a real throwaway account through the UI.
3. Confirm the verification email arrives, and that the link in it opens *your* domain.
4. Grep the server log for delivery failures before declaring launch healthy:

   ```bash
   ./prod_deploy.sh logs server | grep -iE "Failed to send|EmailDeliveryException"
   ```

   Any hit means 100% of real signups are affected, not some.

---

## 3. Bring the stack up, then install TLS

```bash
./prod_deploy.sh up
./prod_deploy.sh ssl-init <your-domain>   # obtains the certificate and swaps in the TLS config
./prod_deploy.sh health
```

`health` must report `TLS: configured`. Until `ssl-init` has run, the site is plaintext HTTP and
`up` refuses to proceed — TLS is installed by config swap, not by hand-editing nginx.

---

## 4. Seed the catalogue

A fresh database has no products. Pick one of the two paths.

### Path A — manifest (recommended)

```bash
cp deploy/catalog-seed.example.json deploy/catalog-seed.json
# edit deploy/catalog-seed.json: replace the three placeholder listings with real ones
```

Upload the product images first and paste the returned paths into `media`:

```bash
# as the operator, through the real upload endpoint
curl -s -X POST https://<your-domain>/api/designer/products/upload/image \
  -H "Authorization: Bearer <operator token>" -F file=@./shirt.jpg
```

Then point the server at it and restart:

```bash
# ./deploy is mounted read-only at /etc/iyae/deploy, so this is the container's path
echo 'CATALOG_SEED_MANIFEST=/etc/iyae/deploy/catalog-seed.json' >> .env
./prod_deploy.sh up
```

`CatalogSeeder` creates each listing under the operator account and **skips any whose `name`
already exists**, so it is safe on every boot. It will not update a listing you have since
edited in the studio — once you touch it there, the manifest is no longer the truth for it.

Note `publish: true` is required per listing. `createProduct` always writes `DRAFT`, and a DRAFT
is invisible to `GET /api/products`.

### Path B — by hand

Sign in as the operator and use `/designer/products` → **Create product**. This is also how real
designers onboard, so it is worth walking once regardless.

---

## 5. Verify — four checks, in this order

### 5a. The catalogue is not empty

```bash
./prod_deploy.sh health
```

Must report `Catalogue: N published product(s)`. If it reports `Catalogue: EMPTY`, stop: every
visitor sees "No pieces found", and the AI stylist will persist outfits with zero slots and hand
the user an empty recommendation rather than an error.

Equivalently, by hand:

```bash
curl -s 'https://<your-domain>/api/products?page=0&size=1' | grep -o '"totalElements":[0-9]*'
```

### 5b. A FEATURED promotion resolves

The homepage carousel reads `GET /api/promotions/featured`, which is a different query from the
catalogue — a non-empty catalogue does not imply a non-empty carousel.

As the operator, create one from `/designer/promotions` (slot `FEATURED`), then:

```bash
curl -s 'https://<your-domain>/api/promotions/featured'   # must not be []
```

Promotions are time-windowed. If this is `[]` with a promotion configured, check `startAt` is in
the past and `endAt` is in the future or null.

### 5c. The operator can administer the instance

- `/admin` loads and the Catalog / Community / Reports / Promotions tabs render.
- The header account menu shows **Studio**, **Promotions** *and* **Admin**.
- Creating a product from `/designer/products/new` succeeds, including the image upload.

If `/designer/products` shows the "Designer area" dead end, the operator has no
`DesignerProfile`. `AdminBootstrap` creates and backfills it on boot — check its log lines:

```bash
./prod_deploy.sh logs server | grep -iE "AdminBootstrap|operator DesignerProfile|Refusing to promote"
```

`Refusing to promote …` means an account with that address already exists but is unverified, or
`ADMIN_BOOTSTRAP_PASSWORD` is not its password. The instance has no administrator until you fix
that — do not work around it by using a different address you do not control.

### 5d. One end-to-end try-on

The 3D path has the most moving parts and the most ways to fail quietly.

1. Register a buyer, verify the email (step 2), and complete the body-measurement step.
2. Generate an avatar from `/profile/avatar` and wait for it to reach READY.
3. Open a product with a `glbUrl` and confirm the garment renders on the avatar.

If generation sits in PENDING forever, the worker is not claiming tasks:

```bash
./prod_deploy.sh logs worker | tail -50
```

With `MODEL_GENERATION_PROVIDER=mock` and `AVATAR_GENERATION_PROVIDER=mock` — the defaults — you
get placeholder geometry, not real models. That is fine for a smoke test. Switching
`AVATAR_GENERATION_PROVIDER` to `smplx` requires the licensed SMPL-X weights mounted at
`SMPLX_MODELS_PATH`, and re-opens finding B-3 (guest avatar GLBs enumerable by sequential task
id) — do not enable it without reading that finding first.

---

## 6. Take a backup before announcing

```bash
./prod_deploy.sh backup
./prod_deploy.sh health      # confirms a recent backup exists
```

The dump contains PII and is written owner-only to `./backups/`. It does **not** rotate — see
finding B-8 — so put a size check on that directory before you leave it unattended; it shares a
filesystem with MySQL's data directory.

---

## Known gaps at the time of writing

Things this runbook works around rather than solves. Each has a finding in
`docs/reviews/2026-10-13-production-readiness-review.md`.

| Finding | Effect on cutover |
|---|---|
| B-10 | No preflight on `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, and no alerting on delivery failure. Step 2 is manual for this reason. |
| B-8 | Backups never rotate and nothing checks disk. |
| B-1 | `update` applies forward-only migrations with no pre-pull backup; its rollback reverts code only. Take a backup before `update`, every time. |
| B-15 | `designer_profiles.is_local` has no write path, so the "Local Designers" filter matches nothing in production — including your seeded listings. |
| B-17 | `garment_assets.slot_hint` is never populated outside the dev seeder, so every production garment is scaled and rigged as a TOP. |
| A-38 | `shopName`, `bio` and `city` are unwritable in every environment. The operator profile carries only a display name. |
| A-13 | Promoting an existing account to ADMIN is one-way; there is no role-change endpoint. |

### A trap specific to non-production environments

`DataSeeder` skips entirely when `users.count() > 0`, and `AdminBootstrap` (`@Order(0)`) runs
before it. So in a **dev or test** stack, setting the admin bootstrap variables against a *fresh*
database makes the seeder find one user already present and seed nothing at all — no designers, no
buyers, no products, and an E2E suite that fails at sign-in. Nothing errors; the environment is
just empty. Production is unaffected (`DataSeeder` is `@Profile({"dev","test"})`).

The dev compose therefore reads `DEV_ADMIN_BOOTSTRAP_EMAIL` / `DEV_ADMIN_BOOTSTRAP_PASSWORD`, not
the production names, so copying a production `.env` into a dev stack cannot trip this. If you do
want to rehearse the catalogue seeding locally it is a two-step job: boot once with them unset so
`DataSeeder` populates the database, then set them and restart. `./dev.sh reset` returns you to
step one.
