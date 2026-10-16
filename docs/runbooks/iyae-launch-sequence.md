# Launch sequence — ③ mail server → ② deploy → ① merge

Concrete steps to bring the `iyae` app up as a **new, independent deployment** alongside the
existing `clossette` one. Nothing in `clossette` is touched; the two run side by side.

The order matters and cannot be reversed. ① (merging the application branches) switches the code
from Resend to SMTP, so merging it before ③ and ② means every email fails instantly. That is why
mail-server setup comes first even though it is the least code-like step.

> **A new app means a new, empty database.** No users, no products, no orders, no admin. That is
> the point of a separate deployment, but it also means the dead-storefront problem is live from
> the first boot — step ②.6 is where that gets solved, and it is not optional.

---

## Before you start — two values to confirm

| | Current value | Why it matters |
|---|---|---|
| `DOMAIN` in `apps/iyae/app.env` | `iyae.ca` | Traefik's host rule, the Let's Encrypt certificate, `CORS_ORIGINS`, and `FRONTEND_BASE_URL` — which goes into every verification and password-reset link. It is set to `iyae.ca` because that is what the application code already uses as its canonical URL and e2e seed domain. **If the site should live on `i-yae.com` instead, change it here before the first deploy** — changing it later means a new certificate and invalidating any links already sent. |
| `GIT_BRANCH` in `apps/iyae/app.env` | `main` | `clossette` still says `prod`, and no `prod` branch exists in the IYAE remote — `git clone --branch prod` fails outright. If you want a release branch, create it and set it here. |

Also note: the site domain and the **mail** domain are deliberately different. Mail is sent from
`i-yae.com`; the site is `${DOMAIN}`. That is fine and normal — DMARC aligns on the `From:`
domain, not on the site.

---

# ③ Mail server (do this first)

Full detail in `mail-setup-stalwart.md`; this is the checklist and the order.

**③.1** In the Stalwart admin UI (`https://mail.ithacateens.com`) → **Management > Directory >
Domains** → add `i-yae.com`. **Copy the DKIM TXT record it shows you** — the private half is
never displayed again.

**③.2** → **Management > Directory > Accounts** → create `noreply@i-yae.com` with an **app
password**. Submission only; it needs no mailbox and no admin rights.

**③.3** Publish DNS on `i-yae.com` (you control this zone):

| Type | Name | Value |
|---|---|---|
| TXT | `i-yae.com` | `v=spf1 ip4:<SERVER_IP> -all` |
| TXT | `<selector>._domainkey.i-yae.com` | from ③.1 |
| TXT | `_dmarc.i-yae.com` | `v=DMARC1; p=none; rua=mailto:dmarc@<a-domain-you-receive-at>` |
| MX | `i-yae.com` | `10 mail.ithacateens.com` — *recommended*, see below |

The server IP is in IthacaServer's `docs/audit-2026-08-20.md` (that file warns it must not be
made public — take the value from there).

**The DKIM record is not optional here.** Stalwart's PTR and HELO identity stays
`mail.ithacateens.com`, so mail from `noreply@i-yae.com` has no aligned identifier without DKIM
and DMARC fails. This differs from adding the *first* domain to a mail server.

MX is not needed to send, but without it bounces and DMARC aggregate reports are
undeliverable — you lose the diagnostics exactly when you need them.

If `i-yae.com` is on Cloudflare, any `mail.*` record must be **DNS-only (grey cloud)**. The HTTP
proxy cannot carry SMTP and a proxied record returns anycast IPs, which breaks the IP → PTR →
SPF chain.

> **Do not touch Settings > Network > "Trusted networks".** Adding the Docker subnet there marks
> it as a reverse proxy and makes Stalwart require the PROXY protocol from every container and
> from Traefik — admin UI 502, SMTP connections reset — **and only after the next container
> restart**, so the breakage looks unrelated to the change that caused it.

**③.4** Capture the certificate name, which step ②.2 needs:

```bash
openssl s_client -connect mail.ithacateens.com:465 -servername mail.ithacateens.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName
```

**③.5** Verify before moving on:

```bash
dig +short TXT i-yae.com
dig +short TXT _dmarc.i-yae.com
dig +short TXT <selector>._domainkey.i-yae.com
```

Then send one message as the new account to the address https://www.mail-tester.com/ gives you
and aim for 9+. Do this **now**, not after launch: it scores SPF, DKIM, DMARC, PTR and blacklist
status in one pass, and fixing a score of 4 is much easier before users depend on it.

**③ is done when** the three DNS lookups return values and mail-tester is 9+.

---

# ② Deploy the new app

All from the IthacaServer checkout on your machine.

**②.1** DNS for the site: point `${DOMAIN}` (an A record) at the server IP. Traefik obtains the
certificate over HTTP-01 on first request, so this must resolve *before* ②.5 or certificate
issuance fails and you burn Let's Encrypt rate limit.

**②.2** Create the secrets file:

```bash
cd /path/to/IthacaServer
cp apps/iyae/.env.extra.example apps/iyae/.env.extra
chmod 600 apps/iyae/.env.extra
```

Fill in every key marked **REQUIRED** — the compose file has `:?` guards on them, so the stack
refuses to start rather than coming up subtly broken:

- `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD` — fresh values, not reused from `clossette`
- `JWT_SECRET` — `openssl rand -base64 32`
- `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` — **the only way this instance can have
  an administrator.** Use an address on a mailbox you control.
- `INTERNAL_MAIL_SECRET` — `openssl rand -base64 32`
- `SMTP_USER` / `SMTP_PASSWORD` — from ③.2
- `MAIL_FROM` — `noreply@i-yae.com`
- `SMTP_TLS_SERVERNAME` — only if ③.4 reported something other than `mail.ithacateens.com`

**②.3** Prepare the starter catalogue. Skipping this gives you a shop that renders
"No pieces found" for every visitor while every health signal reports fine:

```bash
# from the IYAE checkout
cp deploy/catalog-seed.example.json /path/to/IthacaServer/apps/iyae/config/catalog-seed.json
# edit it: replace the three placeholder listings with real ones
```

Then uncomment in `apps/iyae/.env.extra`:

```
CATALOG_SEED_MANIFEST=/etc/iyae/config/catalog-seed.json
```

Product images need to exist before they can be referenced. Either leave `media` pointing at the
placeholder for the first deploy and upload real images through the studio afterwards, or upload
them first (②.7) and re-run with the real paths — the seeder is idempotent by product name, so a
second run fills gaps and overwrites nothing.

**②.4** Commit the new app config (it is four tracked files plus the gitignored `.env.extra`):

```bash
git add apps/iyae/app.env apps/iyae/docker-compose.yml apps/iyae/config/nginx.conf apps/iyae/.env.extra.example
git commit -m "feat(iyae): add IYAE as a separate app"
```

**②.5** Provision. This generates the server `.env`, clones the app repo, creates the
`app-iyae` user and SSH key, builds the three images and starts six containers:

```bash
./scripts/provision.sh iyae
```

**②.6** Verify — and do not skip the catalogue check, it is the one every other signal misses:

```bash
./scripts/validate.sh iyae                 # SSH, containers, .env, TLS, HTTP health
curl -I https://${DOMAIN}
curl -s "https://${DOMAIN}/api/products?page=0&size=1" | grep -o '"totalElements":[0-9]*'
curl -s -o /dev/null -w '%{http_code}\n' "https://${DOMAIN}/api/health/mail"
```

- `totalElements` must be **> 0**. Zero means the catalogue is empty — check the server log for
  `Catalogue seed from …` and for `AdminBootstrap`.
- `/api/health/mail` must be **200**. A 503 means mail cannot be delivered; the body says whether
  the transport or a real send is the problem.

**②.7** Confirm the operator can actually run the shop:

- sign in as `ADMIN_BOOTSTRAP_EMAIL`
- `/admin` loads, and the header account menu shows **Studio**, **Promotions** *and* **Admin**
- `/designer/products/new` creates a product, including the image upload
- `/designer/promotions` creates a `FEATURED` promotion, then
  `curl -s https://${DOMAIN}/api/promotions/featured` is not `[]`

If `/designer/products` shows a "Designer area" dead end, the operator has no designer profile —
check the server log:

```bash
ssh -i keys/iyae app-iyae@<SERVER_HOST> 'ops logs server' | grep -iE "AdminBootstrap|operator DesignerProfile|Refusing to promote"
```

`Refusing to promote …` means an account with that address already exists but is unverified, or
`ADMIN_BOOTSTRAP_PASSWORD` is not its real password. Fix that rather than switching to an address
you do not control.

**②.8** Mail, end to end — the step that catches what no config check can:

1. Register a real throwaway account through the UI.
2. Confirm the verification email **arrives**, and that the link opens `${DOMAIN}`.
3. Grep for failures before declaring success:

```bash
ssh -i keys/iyae app-iyae@<SERVER_HOST> 'ops logs server' | grep -iE "Failed to send|EmailDeliveryException|\[mail-canary\]"
```

Registration returns 201 even when mail fails, and production gates login on verification — so a
user who never receives the link is simply stuck, with no in-app error. Any hit here means 100%
of signups are affected, not some.

**②.9** Take a backup before announcing anything, and confirm it is real (the sidecar stays `Up`
while every dump fails):

```bash
ssh -i keys/iyae app-iyae@<SERVER_HOST> 'ops backup'
./scripts/check-backup-freshness.sh
```

**② is done when** ②.6's three checks pass, ②.7 produces a visible product and a resolving
promotion, and ②.8's email arrives.

---

# ① Merge the application branches

Only now. Merging earlier switches the code to SMTP before there is an SMTP server to reach.

Two branches, and **#50 goes first** — the catalogue seeder that ②.3 depends on lives in it:

1. **PR #50** — `worktree-b11-admin-designer-writes`: ADMIN can write the catalogue, operator
   designer profile, `CatalogSeeder`, cutover runbook.
2. **`worktree-b10-stalwart-mail`** — Resend → SMTP, the mail health endpoint and canary, the
   corrected deployment docs. Not yet pushed; push and open a PR.

After both are on `main`:

```bash
# redeploy the running app onto the merged code
ssh -i keys/iyae app-iyae@<SERVER_HOST> 'ops deploy'
```

Then re-run ②.6 and ②.8. A redeploy rebuilds images from a fresh clone, so the mail path and the
catalogue both get re-exercised.

### One documentation follow-up after both merge

`docs/runbooks/production-cutover.md` (on #50) records B-10 as an open gap and tells the operator
to check mail by hand. After this branch merges that is stale — the preflight and the health
endpoint exist. It was left alone deliberately: editing it from the other branch would have
conflicted.

---

## What is still not solved, stated plainly

- **No outbound alert.** `/api/health/mail` answers 503 and the canary logs `[mail-canary]`, but
  nothing watches either. The monitoring stack here only accepts checks created by hand in its
  UI; until someone creates an HTTP monitor against that URL, discovering a mail outage means
  grepping. Deliberate, at the operator's call.
- **Self-hosted deliverability.** A domain with no sending reputation can land in spam at Gmail
  and Outlook regardless of a perfect SPF/DKIM/DMARC setup. `ithacateens.com` working is
  encouraging but not transferable — reputation is per-domain as well as per-IP. Keep DMARC at
  `p=none` and read the reports before tightening. If deliverability is bad after launch, the
  fallback that undoes none of this work is to point Stalwart at a reputable smarthost; the app's
  configuration does not change.
- **The `/assets/` allow-list now lives in five places** — this app's nginx config in the
  infrastructure repo plus four in the application repo, where a test compares them with each
  other. That test does not see the infrastructure copy, and production serves the infrastructure
  copy. A subtree added in the app repo and forgotten here 404s; one added here and not there
  publishes something the app believes is private. Check both.
- **`clossette` is untouched and still running**, on its own database, still sending through
  Resend. Decide separately whether it is retired, and if any data has to move before it is.
