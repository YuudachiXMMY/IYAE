# Ithaca server — by-hand checklist for step ② (first deploy of IYAE)

Everything in this file is work **only you can do**: on the live host, in DNS, in the Cloudflare
dashboard, in the Stalwart admin UI, in Uptime Kuma, or against the git remote. Nothing here is
fixable by a commit. Conversely, nothing that *is* fixable by a commit is listed as a task — those
are named by title in **[Before you start](#before-you-start-repo-side-fixes-that-must-land-first)**
and belong to the repo owner.

It supersedes `docs/runbooks/iyae-launch-sequence.md` **step ② only** (that file remains the
reference for the why, and for steps ③ and ①). Every command below is inlined, so you should not
need to open it.

Paths used throughout:

| | |
|---|---|
| App repo (this one) | `/Users/jadyn/Development/IYAE` |
| Infra repo | `/Users/jadyn/Development/IthacaServer` |
| Server | `2.24.197.12`, admin user `deploy` — already in your `~/.ssh/config` as **`ithacaDeploy`** |
| App SSH key (created at step 9) | `/Users/jadyn/Development/IthacaServer/keys/iyae` |

---

## ③ (the mail server) is COMPLETE — do not redo any of it

Step ③ of the launch sequence is finished and **nothing in this file asks you to repeat it**. For
the record, that means all of the following are already done and verified:

- `i-yae.com` added to Stalwart under *Management > Directory > Domains*
- the `noreply@i-yae.com` submission account created with an app password
- SPF, DKIM and DMARC published on `i-yae.com` (measured today: SPF `v=spf1 mx -all`,
  `_dmarc` = `v=DMARC1; p=none; rua=mailto:postmaster@i-yae.com`, MX `10 mail.ithacateens.com`)
- the certificate name on the submission port captured

**Step ① (the merge) is also done** — PRs #50, #51 and #52 are merged into `main` at `cd69333`.
What is *not* done is the second half of ①, the one-line ref push, which is **step 2 below**.

### The three step-③ values you must have on hand before step 5

| Needed at | Value | Where it came from |
|---|---|---|
| `SMTP_USER` | `noreply@i-yae.com` | ③.2 — already pre-filled in `apps/iyae/.env.extra` |
| `SMTP_PASSWORD` | the **app password** for that account | ③.2 — already filled in `apps/iyae/.env.extra` (40 chars, verified present) |
| `SMTP_TLS_SERVERNAME` | `mail.ithacateens.com` | ③.4 — this is the compose default, so **leave it unset** unless ③.4 reported a different name |

You also need, and only you have:

- the **Cloudflare** login for the `i-yae.com` zone
- the **Stalwart admin** login (`https://mail.ithacateens.com`)
- the **Uptime Kuma** login
- GitHub write access to `YuudachiXMMY/IYAE` (for the deploy key and the ref push)
- an **external throwaway mailbox** (Gmail/Outlook — not on this host) for the step-15 mail test

---

## Before you start: merge the repo-side fixes

All eleven repo-side fixes this checklist originally listed as pending are **written and pushed**,
in the infrastructure repo, on branch **`worktree-iyae-deploy-fixes`** (4 commits, base
`origin/main`). Nothing below depends on an unwritten change any more — but the branch is **not
merged**, so do this first:

```bash
cd /Users/jadyn/Development/IthacaServer
git fetch origin
gh pr create --base main --head worktree-iyae-deploy-fixes --fill   # or merge it however you prefer
```

**Verify** — the two things whose absence would otherwise bite you at step 9 and step 10:

```bash
cd /Users/jadyn/Development/IthacaServer
git log --oneline -4
grep -c ':?set\|:?' apps/iyae/docker-compose.yml          # expect 9 (was 7 — the two DB keys)
grep -n 'CHANGE_ME' apps/iyae/app.env || echo "placeholders gone — good"
bash scripts/tests/require-paired-vars.test.sh | tail -1   # expect PASS 12
```

What landed, so you know which steps below are now automatic:

| Was a manual step | Now |
|---|---|
| `DB_PASSWORD` / `MYSQL_ROOT_PASSWORD` could ship as `CHANGE_ME` | both `:?`-guarded, placeholders deleted from `app.env` |
| backup dir left `root:root`, every dump failing silently | `provision.sh` creates and chowns it before `up` (step 10 is now a verification, not a fix) |
| `provision.sh` printed "Application started" unconditionally | readiness gate: fails if any declared service is not running, and prints the deployed SHA |
| `/assets/images/**` 404'd in production | proxied to the web container |
| `AI_PROVIDER=minimax` + empty key failed silently at runtime | `provision.sh` refuses to provision on the unpaired combination |
| `www.i-yae.com` answered a bare 404 | Traefik router + redirect to the apex |
| healthcheck was `/api/health` (200 with the DB down) | `/api/health/ready` |
| `iyae` absent from backup coverage | in `EXPECTED_TARGETS`; unused `_backups/iyae` no longer created |
| nothing noticed the mail certificate expiring | daily `check-cert-expiry.sh` + `/etc/cron.d/cert-expiry` |
| `ops backup` printed a PROCESS-privilege error every run | `--no-tablespaces` |

**Two things were deliberately NOT fixed in code**, and they stay yours:

- **Renewing the mail certificate (step 1).** Only *detection* was automated. Which mechanism
  issued the `:465` copy, and where it writes, is inside the `stalwart-etc` volume and not in
  either repo — and the two plausible causes need different fixes, so guessing a destination path
  would risk breaking mail outright. `infrastructure/mail/README.md` now carries both causes and
  the commands that tell them apart.
- **The client-IP chain behind Cloudflare (step 6).** Restoring real per-visitor rate-limit
  buckets requires giving Traefik's `websecure` entryPoint `forwardedHeaders.trustedIPs`, which is
  host-global and changes the client IP **every** app on this host observes. The app's own subnet
  is now pinned and the correct value is documented, but the default is unchanged on purpose:
  narrowing it halfway is strictly worse than leaving it (see step 6).

---

## Two measured facts that change the plan

Both measured from this machine on **2026-10-18 22:35 UTC**. Re-measure before you act; the first
one is on a clock.

### A. The mail server's submission certificate expires in about 43 hours

```
$ echo | openssl s_client -connect mail.ithacateens.com:465 -servername mail.ithacateens.com \
    2>/dev/null | openssl x509 -noout -subject -issuer -dates -serial
subject=CN=mail.ithacateens.com
issuer=C=US, O=Let's Encrypt, CN=YR1
notBefore=Jul 22 18:04:17 2026 GMT
notAfter=Oct 20 18:04:16 2026 GMT          <-- expires 2026-10-20 18:04 UTC
serial=05A4C9EE51DEB20F31A93D5871EA5C019781
```

IYAE is the **only** app on this host that verifies that certificate. Every other app sets
`SMTP_TLS_INSECURE=1`; IYAE deliberately does not. The moment it expires, every outbound mail fails
the TLS handshake — and registration still answers **201** with a working token, sends nothing, and
production gates login on email verification. Every account created after that minute is
permanently locked out, with no error shown anywhere in the app. That is **step 1**, and it comes
before everything else.

### B. `i-yae.com` already points at this server. There is no DNS step, and no grace period.

```
$ dig +short A i-yae.com        ->  172.64.80.1     (Cloudflare edge)
$ dig +short A www.i-yae.com    ->  172.64.80.1
$ dig +short NS i-yae.com       ->  norman.ns.cloudflare.com. / aron.ns.cloudflare.com.

$ curl -s https://i-yae.com/                                         ->  "404 page not found"
$ curl -sk --resolve i-yae.com:443:2.24.197.12 https://i-yae.com/    ->  "404 page not found"
$ echo | openssl s_client -connect 2.24.197.12:443 -servername i-yae.com 2>/dev/null \
    | openssl x509 -noout -subject
subject=CN=TRAEFIK DEFAULT CERT
```

The edge and the origin return byte-identical responses, and that 19-byte `text/plain` body is
Traefik's own 404. So Cloudflare is **already proxying `i-yae.com` to this server's Traefik**. Three
consequences:

- **The apex A record already exists and is correct. Do not create, re-point, or change it.** The
  launch sequence's step ②.1 ("point `i-yae.com` at the server IP") is already satisfied.
- **The site becomes publicly reachable the instant the Traefik router comes up** — i.e. the
  moment `provision.sh` finishes `up -d`. There is no DNS propagation window to hide in. Secrets
  (step 5) and the starter catalogue (step 7) must therefore be complete **before** step 9, not
  after.
- The zone is in Cloudflare SSL/TLS mode **Full, not Full (strict)** — proven by the edge passing
  through a response from an origin presenting a self-signed cert; strict mode would have returned
  error 526. **Leave it on Full.** Setting strict before Let's Encrypt has issued for `i-yae.com`
  makes the whole site answer 526. Step 14 is where you may raise it.

HTTP-01 issuance will work through the orange cloud: `http://i-yae.com/.well-known/acme-challenge/…`
returns a 404 **from the origin** rather than a 301, so Cloudflare forwards the challenge path
instead of redirecting it to HTTPS (verified today).

---

# The steps

Eighteen steps. 1–8 are preparation and can all be done before anything is live. 9 is the deploy.
10–18 are verification and the things that must exist before you tell anyone the site is up.

---

## 1. Replace the certificate Stalwart serves on port 465 — hard deadline 2026-10-20 18:04 UTC

**Why:** see fact A. Without this, launch has a two-day fuse after which every new signup is
permanently bricked and no signal in the app says so.

**Why it will not fix itself:** the mail ports are published directly by the Stalwart container and
are *not* Traefik entrypoints (`infrastructure/traefik/traefik.yml` says so explicitly). Traefik
renewed its own copy of the `mail.ithacateens.com` certificate on Sep 21 (valid to Dec 20) for the
admin-UI router on :443, but Stalwart's listener on :465 is still serving the July copy. Two
independent certificates for one hostname; only one of them is being renewed.

**Detection is now automated; the renewal is still this step.** The merged branch adds
`scripts/check-cert-expiry.sh` and `/etc/cron.d/cert-expiry`, which fails daily while any
mail-port certificate is inside 21 days — so this specific surprise cannot recur. It deliberately
does not install anything, because the destination path is only inside the `stalwart-etc` volume
and the two plausible causes need different fixes; `infrastructure/mail/README.md` now carries
both, plus the commands that tell them apart. Run it right now to see the current state:

```bash
cd /Users/jadyn/Development/IthacaServer && ./scripts/check-cert-expiry.sh
# today: WARN on :465 and :993 (1 day), OK on :443 (62 days) — the two certificates, side by side
```

First, find out where Stalwart's listener gets its certificate. This is **not** in either repo —
Stalwart's config lives in the `stalwart-etc` Docker volume — so it has to be read, not assumed:

```bash
ssh ithacaDeploy
sudo docker exec stalwart ls -la /etc/stalwart
sudo docker logs --tail 200 stalwart 2>&1 | grep -iE 'acme|certificate|tls|expir'
```

and in the admin UI at `https://mail.ithacateens.com`, check **Settings > Server > TLS** for the
certificate entry and its cert/key paths, plus any ACME section.

**Preferred fix — reuse the certificate Traefik already renews for the same hostname.** Extract the
PEM pair from Traefik's ACME store (read-only; do not chmod or edit `acme.json`, Traefik refuses it
at anything but 600):

```bash
ssh ithacaDeploy
sudo python3 - <<'PY'
import base64, json, pathlib
d = json.load(open('/opt/apps/_infrastructure/traefik/acme.json'))
for res in d['letsencrypt']['Certificates']:
    if res['domain']['main'] == 'mail.ithacateens.com':
        pathlib.Path('/tmp/mail-fullchain.pem').write_bytes(base64.b64decode(res['certificate']))
        pathlib.Path('/tmp/mail-privkey.pem').write_bytes(base64.b64decode(res['key']))
        print('extracted')
PY
sudo openssl x509 -in /tmp/mail-fullchain.pem -noout -subject -dates -serial
# expect notAfter around Dec 20 2026, and a serial that is NOT 05A4C9EE...9781
```

Then install it at the paths you found above and restart — **the restart is required**, the
listener holds the certificate in memory and a file swap alone changes nothing:

```bash
sudo docker cp /tmp/mail-fullchain.pem stalwart:<cert-path-from-the-admin-UI>
sudo docker cp /tmp/mail-privkey.pem  stalwart:<key-path-from-the-admin-UI>
sudo rm -f /tmp/mail-fullchain.pem /tmp/mail-privkey.pem
sudo docker restart stalwart
```

> **Known gap:** I cannot tell you the exact destination paths from the repos — they are only in
> that volume and in the admin UI. Read them in the step above and substitute.

**Verify:**

```bash
echo | openssl s_client -connect mail.ithacateens.com:465 -servername mail.ithacateens.com \
  2>/dev/null | openssl x509 -noout -dates -serial
# PASS: notAfter is Dec 2026 or later, AND serial != 05A4C9EE51DEB20F31A93D5871EA5C019781

echo | openssl s_client -connect mail.ithacateens.com:465 -servername mail.ithacateens.com \
  2>/dev/null | openssl x509 -noout -checkend 2592000 && echo "OK: >30 days left"

# IMAPS serves the same certificate today — check it too, external mail clients break with it:
echo | openssl s_client -connect mail.ithacateens.com:993 -servername mail.ithacateens.com \
  2>/dev/null | openssl x509 -noout -dates
```

**Emergency fallback, only if the certificate cannot be replaced before you must launch:** set
`SMTP_TLS_INSECURE=1` in `apps/iyae/.env.extra` at step 5. Understand the cost — the hop stays
encrypted but stops being *authenticated*, which is the one protection this app deliberately kept
when every sibling app gave it up. Time-box it, write the date next to it, and revert it the moment
step 1 is properly done.

**If you skip this step entirely:** mail works for about 43 hours, then every account created from
that minute on is permanently unable to log in, silently.

---

## 2. Advance `origin/prod` to the merged commit

**Why:** `apps/iyae/app.env:29` pins `GIT_BRANCH="prod"` and `provision.sh` clones exactly that ref.
It is still at the pre-merge commit, 24 commits behind `main`:

```
refs/heads/main          cd69333b26ba10754f6c25a9683755bf098e55b2
refs/heads/prod          ed1fc8c7938898429afc7831c6e12f9b00ca4ad9   <-- what would be deployed
refs/heads/clossette-prod ed1fc8c7938898429afc7831c6e12f9b00ca4ad9  <-- same SHA; do NOT move this
```

Provisioning now builds code from before #50/#51/#52. The server would read `RESEND_MAIL_ENDPOINT`,
which the infra compose does not set, refuse to start with *"Refusing to start: 1 production
configuration error(s) … RESEND_MAIL_ENDPOINT is empty"*, and crash-loop — and because `web` and
`nginx` both gate on `server: condition: service_healthy`, neither ever starts, so the whole site
stays down while `provision.sh` prints "Application started". That build also has no
`CatalogSeeder`, no `/api/health/mail`, no ADMIN catalogue writes, and runs every container as root
— which seeds the shared `assets_data` volume root-owned and leaves a trap for the next deploy
(step 11).

This is a fast-forward (`prod` is an ancestor of `main`, verified), so no force is needed:

```bash
cd /Users/jadyn/Development/IYAE
git fetch origin
git push origin origin/main:prod
```

**Verify:**

```bash
git ls-remote --heads origin prod
# must print exactly:
# cd69333b26ba10754f6c25a9683755bf098e55b2	refs/heads/prod
```

Use that exact one-ref form. A bare `git ls-remote --heads origin` lists `clossette-prod` at the
*old* SHA right above `prod`, which is easy to misread as failure.

**Do not run `provision.sh` until that line reads `cd69333…`.** Note also that `clossette-prod`
must stay at `ed1fc8c` — it is what keeps the still-running `clossette` app off this code.

**If you skip this step:** the deploy does not come up at all, and you will spend the debugging
session chasing a missing Resend variable two days after configuring SMTP.

---

## 3. Confirm `deploy` has passwordless sudo

**Why:** every step of `provision.sh` runs `sudo` over a non-interactive SSH session — user
creation, `/etc/sudoers.d` writes, chowns, the compose wrapper. The script preflights this and
aborts, but it is cheaper to check now than to abort a third of the way through creating users.

```bash
ssh ithacaDeploy 'sudo -n true && echo NOPASSWD-OK'
```

**Verify:** prints `NOPASSWD-OK`.

**If it fails,** grant it once (this is the exact text `provision.sh` suggests):

```bash
ssh -t ithacaDeploy "echo 'deploy ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/deploy && sudo chmod 440 /etc/sudoers.d/deploy"
```

---

## 4. Tighten the permissions on the secrets file

**Why:** `apps/iyae/.env.extra` already holds the live Stalwart app password and is currently mode
**644** (measured), i.e. readable by every account on your machine. It is about to hold the JWT
signing secret and both database passwords too. Nothing in the deploy path checks or fixes its mode.

```bash
cd /Users/jadyn/Development/IthacaServer
chmod 600 apps/iyae/.env.extra
```

**Verify:**

```bash
stat -f '%Lp %N' apps/iyae/.env.extra
# expect: 600 apps/iyae/.env.extra
```

**If you skip it:** a leaked `JWT_SECRET` alone is enough to forge an ADMIN token for the live site.

---

## 5. Fill in every required secret in `apps/iyae/.env.extra`

**Why:** this gitignored file is appended verbatim to the server's generated `.env` and is the only
required-variable mechanism on this deploy path. Six required keys are currently **present but
empty** (measured): `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `JWT_SECRET`, `ADMIN_BOOTSTRAP_EMAIL`,
`ADMIN_BOOTSTRAP_PASSWORD`, `INTERNAL_MAIL_SECRET`. Only the three SMTP values from ③ are filled.

Generate the five machine secrets, then paste them in:

```bash
cd /Users/jadyn/Development/IthacaServer
openssl rand -base64 32   # -> JWT_SECRET            (must be >= 32 chars)
openssl rand -base64 32   # -> INTERNAL_MAIL_SECRET
openssl rand -base64 24   # -> DB_PASSWORD
openssl rand -base64 24   # -> MYSQL_ROOT_PASSWORD
openssl rand -base64 18   # -> ADMIN_BOOTSTRAP_PASSWORD   (keep this — you will type it at step 13)
```

This is the complete contract, derived from `apps/iyae/docker-compose.yml` rather than from prose.
Everything not listed here has a correct default in the compose file and must be left alone.

```sh
# ── Database — REQUIRED. This is now the ONLY place they exist ──
# Both are `:?`-guarded, and the `CHANGE_ME` duplicates are gone from app.env, so a
# blank value here can no longer be mistaken for a fallback — the stack refuses to
# start instead. Fill both before the first `up`: MySQL reads them only while
# initialising an empty data directory.
DB_PASSWORD=<openssl rand -base64 24>
MYSQL_ROOT_PASSWORD=<openssl rand -base64 24>

# ── Auth — REQUIRED ──
JWT_SECRET=<openssl rand -base64 32>

# ── Administrator — REQUIRED. The only way this instance can have an admin ──
ADMIN_BOOTSTRAP_EMAIL=<an address on a mailbox you control>
ADMIN_BOOTSTRAP_PASSWORD=<openssl rand -base64 18>

# ── Transactional mail — REQUIRED ──
INTERNAL_MAIL_SECRET=<openssl rand -base64 32>
SMTP_USER=noreply@i-yae.com          # already filled from ③
SMTP_PASSWORD=<paste-from-stalwart>  # already filled from ③ (the app password)
MAIL_FROM=noreply@i-yae.com          # already filled from ③

# ── Starter catalogue — uncomment at step 7 ──
# CATALOG_SEED_MANIFEST=/etc/iyae/config/catalog-seed.json

# ── AI provider — DECIDE. provision.sh now refuses the unpaired combination ──
# minimax with an empty key boots clean and then answers every AI-stylist message
# with "I'm having trouble connecting right now." forever, at HTTP 200, with no
# health signal going red. provision.sh now fails fast on exactly that pair
# (app.env declares the rule in REQUIRE_PAIRED_VARS), so you will be stopped at
# step 9 rather than discovering it from a user. Supply the key...
AI_PROVIDER=minimax
MINIMAX_API_KEY=<paste-real-key>
#   ...or, if you do not have a key for launch, make the behaviour deliberate:
# AI_PROVIDER=mock

# ── Leave as shipped ──
MODEL_GENERATION_PROVIDER=mock
AVATAR_GENERATION_PROVIDER=mock
RIGGING_PROVIDER=mock
WORKER_MESHY_API_KEY=
# STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET stay absent — payments ship OFF for
# launch 1, and both-blank is the supported configuration (checkout answers 503
# and the web client hides its entry points).
# SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_TLS_SERVERNAME / SMTP_TLS_INSECURE:
# the compose defaults (stalwart / 465 / 1 / mail.ithacateens.com / 0) are correct
# for this host. Only set SMTP_TLS_SERVERNAME if ③.4 reported a different name.
# RATE_LIMIT_TRUSTED_PROXIES: leave commented — see step 6.
```

**Verify** — this must print nothing:

```bash
grep -nE '^(DB_PASSWORD|MYSQL_ROOT_PASSWORD|JWT_SECRET|ADMIN_BOOTSTRAP_EMAIL|ADMIN_BOOTSTRAP_PASSWORD|INTERNAL_MAIL_SECRET|SMTP_USER|SMTP_PASSWORD|MAIL_FROM)=$' \
  apps/iyae/.env.extra
```

and the secret must be long enough:

```bash
awk -F= '/^JWT_SECRET=/{print length(substr($0,12))}' apps/iyae/.env.extra   # expect >= 32
```

Then dry-run the interpolation locally, before touching the server:

```bash
mkdir -p /tmp/iyaecheck && cp apps/iyae/docker-compose.yml /tmp/iyaecheck/
printf 'DB_TYPE=mysql\nDB_NAME=iyae\nDB_USER=iyae\nDOMAIN=i-yae.com\n\n' > /tmp/iyaecheck/.env
cat apps/iyae/.env.extra >> /tmp/iyaecheck/.env
(cd /tmp/iyaecheck && docker compose config --quiet && echo COMPOSE-OK)
rm -rf /tmp/iyaecheck
```

`COMPOSE-OK` means no `:?` guard will fire. It does **not** prove the two database passwords are
set — they have no guard — which is what the `grep` above is for.

**Do not** put `DB_PASSWORD` or `MYSQL_ROOT_PASSWORD` in `apps/iyae/app.env` instead, and do not
*delete* the empty lines here in the hope that app.env takes over: `app.env` is git-tracked and
still carries literal `CHANGE_ME` placeholders, and `MYSQL_ROOT_PASSWORD` set there is silently
discarded in favour of the repo-published literal `CHANGE_ME_ROOT`.

**If you skip any of it:**

- blank `JWT_SECRET` / `ADMIN_BOOTSTRAP_*` / `INTERNAL_MAIL_SECRET` / `SMTP_*` → compose refuses to
  start and names the key. Loud, harmless.
- blank `MYSQL_ROOT_PASSWORD` → `iyae-db` aborts with *"Database is uninitialized and password
  option is not specified"* and every dependent container reports `dependency failed to start`.
- blank `DB_PASSWORD` with the root password set → **the bad one.** MySQL only warns, the database
  comes up **healthy**, the `iyae` user is never created, and the server crash-loops on *"Access
  denied for user 'iyae'"*. MySQL honours those variables only when initialising an empty data
  directory, so filling the file afterwards and redeploying changes nothing — you must drop the
  `iyae_db-data` volume (step 18) or create the user by hand.
- blank `ADMIN_BOOTSTRAP_*` → there is no other way to create an administrator; `/admin` would be
  live and reachable by nobody and no product could ever be published.

---

## 6. Decide the Cloudflare proxy question — and most likely change nothing

**Why this is a decision and not an instruction:** the record is already orange-clouded (fact B),
and Traefik is configured with no `forwardedHeaders.trustedIPs`, so the client address the app sees
is a **Cloudflare edge IP**, not the visitor's. The app's per-IP limits then become buckets shared
by large groups of visitors: register 3/min, forgot-password 3/min, resend-verification 3/min,
login 5/min, AI chat 10/min. On launch day with a handful of concurrent visitors the signup funnel
closes intermittently with a 429 that no log attributes to anyone — the app's own gateway sets
`access_log off;` and Traefik ships no access log.

The options, honestly:

- **Leave it orange (recommended for this deploy).** Status quo, no DNS change during launch, and
  the Cloudflare edge that the Traefik middlewares assume stays in front. You accept the shared
  rate-limit buckets as a known launch-day defect.
- **Grey-cloud it (DNS-only, `A i-yae.com -> 2.24.197.12`).** Makes the TCP peer the real visitor
  and the existing chain correct — this is what `clossette.ca` does (verified: it resolves straight
  to `2.24.197.12`). The cost is that it publishes the origin IP and takes the site out from behind
  the edge, which is a bigger change than it looks on launch day.

**Whichever you choose, do not hand-edit `RATE_LIMIT_TRUSTED_PROXIES` to "just nginx's address."**
There are two internal proxy hops here (Traefik → nginx → server), not one. Trusting only nginx
makes the walk stop at Traefik's address, and then *every request on the entire site* keys to a
single bucket — strictly worse than today. That fix is a repo-side design change, not a value swap.

**Verify (whichever you chose):**

```bash
dig +short A i-yae.com
# orange: 172.64.80.1   |   grey: 2.24.197.12
```

Also, in **Cloudflare > i-yae.com > SSL/TLS > Overview**, confirm the mode is **Full** and leave it
there until step 14. If it is ever switched to **Flexible**, Traefik's global :80→:443 redirect
turns every page load into an infinite redirect loop (`ERR_TOO_MANY_REDIRECTS`).

**Do not touch** any `mail.*` record, the MX, or the SPF/DKIM/DMARC TXT records — those are ③'s
output and are correct.

---

## 7. Create the starter catalogue manifest

**Why:** a new app means a new, empty database. Flyway inserts no content and the dev seeder does
not run under the prod profile. Without this, `/api/products` answers `totalElements: 0`, the shop
renders "No pieces found" for every visitor, and **every health signal reports fine** — the
readiness probe only checks the database.

```bash
cp /Users/jadyn/Development/IYAE/deploy/catalog-seed.example.json \
   /Users/jadyn/Development/IthacaServer/apps/iyae/config/catalog-seed.json
```

Now **edit it**: the shipped file contains three fictitious placeholder listings. Copying it
verbatim publishes three fake products on the public storefront, which is worse than empty. Replace
them with real listings, and keep `"publish": true` on each — `createProduct` always writes DRAFT,
and a DRAFT is invisible to `GET /api/products`.

On images: `media` paths must exist. The example's `/assets/images/products/placeholder.svg` now
resolves in production (the nginx fix is on the merged branch), so leaving it is safe — but it is
a placeholder on a public storefront. Either point `media` at real images, or leave it empty and
upload through the studio at step 13, then re-run: the seeder is idempotent by product name, so a
second run fills gaps and overwrites nothing.

Then uncomment the one line in `apps/iyae/.env.extra`:

```
CATALOG_SEED_MANIFEST=/etc/iyae/config/catalog-seed.json
```

That container path is correct: `provision.sh` rsyncs `config/` and the compose file mounts it
read-only at `/etc/iyae/config`. (`production-cutover.md` says `/etc/iyae/deploy/…` — that path has
no mount behind it on this deploy path and would silently seed nothing.)

**Verify:**

```bash
python3 -m json.tool /Users/jadyn/Development/IthacaServer/apps/iyae/config/catalog-seed.json >/dev/null && echo JSON-OK
grep -c '^CATALOG_SEED_MANIFEST=' /Users/jadyn/Development/IthacaServer/apps/iyae/.env.extra   # expect 1
```

(The post-deploy check is at step 12.)

---

## 8. Commit the infra app config

**Why:** four tracked files define this app. If they are not committed, the next person to
re-provision from a clean checkout stands up a different application — and `provision.sh` will
refuse the run rather than silently drop your live secrets, which is a confusing place to discover
it. `.env.extra` is gitignored and stays out of this.

```bash
cd /Users/jadyn/Development/IthacaServer
git add apps/iyae/app.env apps/iyae/docker-compose.yml apps/iyae/config/nginx.conf \
        apps/iyae/.env.extra.example apps/iyae/config/catalog-seed.json
git commit -m "feat(iyae): add IYAE as a separate app"
```

**Verify:**

```bash
git status --short apps/iyae/
# expect only:  ?? apps/iyae/.env.extra   (gitignored — must NOT be staged)
git check-ignore -v apps/iyae/.env.extra   # expect a .gitignore hit
```

---

## 9. Provision — this is the moment the site goes public

**Why:** nothing for this app exists on the host yet — no `app-iyae` user, no `/opt/apps/iyae`, no
`/opt/apps/.control/iyae`, no containers. This one script creates all of it, clones `prod`, builds
three images and starts six containers.

**Before you run it, confirm all of 1–8 are done.** Because the DNS record already proxies to this
server (fact B), the storefront is live to the internet the second `up -d` returns. There is no
buffer in which to fix an empty catalogue or a missing secret.

```bash
cd /Users/jadyn/Development/IthacaServer
./scripts/provision.sh iyae
```

It pauses twice:

1. a confirmation prompt;
2. an **ACTION REQUIRED** box printing a freshly generated ed25519 deploy public key. Paste it into
   `https://github.com/YuudachiXMMY/IYAE` → **Settings → Deploy keys → Add deploy key** (read-only
   is sufficient), then answer `y`. The clone cannot succeed until you do, and aborting here leaves
   a half-provisioned app.

Budget **10–20 minutes** after that: it builds a Gradle/JDK 22 server image, a Node web image, and
a Python worker image on the host.

`provision.sh` now ends with a readiness gate, so its verdict is trustworthy: it waits for every
service the compose file declares to be running, prints `Deployed prod at cd69333`, and **exits
non-zero** with the missing/unhealthy containers named if they do not all come up. A pass is
`Application started — all 6 service(s) running`.

Two failures it can now report that are worth recognising on sight:

- *Malformed REQUIRE_PAIRED_VARS* / *`AI_PROVIDER=minimax` requires `MINIMAX_API_KEY`* — the
  preflight, before anything is installed. Go back to step 5.
- **`failed to create network ... Pool overlaps with other one on this address space`** — the
  app's internal network is pinned to `10.89.1.0/24`, chosen to sit outside Docker's default pool
  so a clash fails loudly here rather than silently handing the app a subnet that makes the
  trusted-proxy list wrong. If the host's `/etc/docker/daemon.json` sets `default-address-pools`
  to something covering `10.89/16`, this is that clash. Pick another free /24 in
  `apps/iyae/docker-compose.yml` (and update the value quoted in step 6):
  `ssh ithacaDeploy "cat /etc/docker/daemon.json; docker network ls -q | xargs -n1 docker network inspect -f '{{.Name}} {{range .IPAM.Config}}{{.Subnet}}{{end}}'"`

**Verify independently anyway:**

```bash
ssh -i keys/iyae app-iyae@2.24.197.12 'ops status'
# all six must be Up/healthy: iyae-nginx iyae-web iyae-server iyae-worker iyae-db iyae-db-backup
# the Git: line must show prod at cd69333

ssh -i keys/iyae app-iyae@2.24.197.12 'ops logs server' \
  | grep -iE 'Production configuration validated|Refusing to start|Successfully applied'
# expect "Production configuration validated" and Flyway applying 26 migrations
```

Be aware that `validate.sh`'s "Containers running" check still passes if *any single* container is
Up, so a crash-looping server shows green **there**. Trust the provision gate, `ops status` and the
server log.

**If this step fails:** go to [If the deploy fails](#if-the-deploy-fails-how-you-know-and-how-to-abort).

---

## 10. Verify the backup directory's ownership

**Why:** the db-backup sidecar runs as the image's `appuser` (uid 1005), so
`./data/backups/mysql` on the host must be writable by 1005 — otherwise every dump fails with
*permission denied* AFTER authenticating, while the container stays `Up` with restart count 0.
That is the 2026-08-20 incident on this very host. `provision.sh` deliberately prunes `data/` from
both of its chown passes (it holds container-owned volume data), which is correct and is also why
nothing used to create this directory: Docker auto-created it `root:root` at first `up`.

**This is now done for you** — `BACKUP_DIR_UID="1005"` in `apps/iyae/app.env` makes `provision.sh`
create and chown it before `up`, and step 9 printed
`Backup dir /opt/apps/iyae/data/backups/mysql owned by 1005`. So this step is a check, not a fix.

If you provisioned before merging the branch, or the line is missing, do it by hand:

```bash
ssh ithacaDeploy
sudo mkdir -p /opt/apps/iyae/data/backups/mysql
sudo chown -R 1005:1005 /opt/apps/iyae/data/backups/mysql
sudo chmod 750 /opt/apps/iyae/data/backups/mysql
sudo /opt/apps/.control/iyae/docker-compose-wrapper.sh restart db-backup
```

**Verify:**

```bash
ssh ithacaDeploy "stat -c '%u:%g %a' /opt/apps/iyae/data/backups/mysql"
# expect: 1005:1005 750

ssh ithacaDeploy 'sudo docker logs --tail 50 iyae-db-backup 2>&1 | grep -iE "denied|permission|error"'
# expect no output

ssh ithacaDeploy 'sudo ls -l /opt/apps/iyae/data/backups/mysql/'
# the sidecar dumps once on start, so expect a *.tgz within a minute or two
```

**If you skip it:** the production database holding every account, order and body measurement runs
with **zero automated backups**, and the container reports `Up` with restart count 0 the whole time.
You find out when you need a restore.

Note uid 1005 is deliberate and must not be "tidied" to `app-iyae`: app users are created with
`useradd --system` and so always get a uid below 1000.

---

## 11. Confirm the shared asset volume is writable by the non-root containers

**Why:** server, worker and nginx all mount `assets_data`, and the merged images run as uid 10001.
A genuinely fresh volume inherits 10001 from the image directory, so a correct first deploy gets
this for free — but there is **no `claim_asset_volume` equivalent anywhere on this deploy path**
(that helper lives only in `dev.sh` / `prod_deploy.sh`, which never run here). If anything ever
created that volume from a root-era image, it stays root-owned and the non-root server silently
cannot write: designer image uploads 500, `GlbAssetInitializer` logs *"could not write placeholder
GLB"*, and every generated model task fails — with no health signal changing.

```bash
ssh ithacaDeploy "sudo docker run --rm -v iyae_assets_data:/a alpine stat -c '%u:%g' /a"
```

**Verify:** prints `10001:10001`. If it prints `0:0`, claim it once and recreate the writers:

```bash
ssh ithacaDeploy
WRAP=/opt/apps/.control/iyae/docker-compose-wrapper.sh
sudo $WRAP stop server worker nginx
sudo docker run --rm -u 0:0 -v iyae_assets_data:/a alpine chown -R 10001:10001 /a
sudo $WRAP up -d
```

The bare `docker run` is deliberate: the compose wrapper excludes `run` from its allow-list and
blocks `--user` and `-v`, so this must be issued by `deploy`, not by `app-iyae`.

The real proof is functional, at step 13: an image upload that returns 201 and renders.

---

## 12. Confirm all 26 migrations applied against the real MySQL

**Why:** the server's test suite runs on H2 with Flyway disabled, so no test has ever executed a
migration. This host is the first real MySQL 8 to see V1–V26 outside `scripts/verify-migrations.sh`.
A partially-applied history is cheap to fix now and much harder once there are user rows — and
Flyway refuses to proceed on a later boot if a migration is recorded as failed.

```bash
ssh ithacaDeploy
sudo docker exec -i iyae-db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root --batch iyae -e "
  SELECT COUNT(*) AS applied, SUM(success=0) AS failed, MAX(version) AS top FROM flyway_schema_history;
  SELECT version, description FROM flyway_schema_history WHERE success = 0;
  SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = \"resale_listings\" AND column_name = \"original_order_id\";
  SHOW INDEX FROM follows;
"'
```

**Verify:** `failed` is `0` or NULL; `top` is `26`; the second query returns no rows;
`is_nullable` is `NO` (proves V25 applied); and `SHOW INDEX FROM follows` lists `uk_follows_pair`
and `idx_follows_following` but **not** `idx_follows_follower` (proves V26 applied).

---

## 13. Confirm the public surface, and that you can actually run the shop

**Why:** containers Up, database reachable and TLS valid are all compatible with a dead storefront.
The catalogue check is the one every other signal misses.

```bash
cd /Users/jadyn/Development/IthacaServer
./scripts/validate.sh iyae

curl -sI https://i-yae.com | head -1
curl -s -o /dev/null -w 'ready=%{http_code}\n' https://i-yae.com/api/health/ready
curl -s -o /dev/null -w 'mail=%{http_code}\n'  https://i-yae.com/api/health/mail
curl -s 'https://i-yae.com/api/products?page=0&size=1' | grep -o '"totalElements":[0-9]*'
curl -s https://i-yae.com/api/promotions/featured
```

**Verify:** `ready=200`; `mail=200` (a 503 means mail cannot be delivered — the body says whether
the transport or a real send is the problem); `totalElements` **> 0**; and the certificate is now
Let's Encrypt for this name:

```bash
echo | openssl s_client -connect i-yae.com:443 -servername i-yae.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
# expect subject CN=i-yae.com and an issuer containing Let's Encrypt
```

If `totalElements` is 0, check the seed ran:

```bash
ssh -i keys/iyae app-iyae@2.24.197.12 'ops logs server' \
  | grep -iE 'Catalogue seed|AdminBootstrap|operator DesignerProfile|Refusing to promote'
```

`Refusing to promote …` means an account with your `ADMIN_BOOTSTRAP_EMAIL` already exists but is
unverified, or the password you set is not its real password. Fix that rather than switching to an
address you do not control.

Then, in a browser, sign in as `ADMIN_BOOTSTRAP_EMAIL` and confirm:

- `/admin` loads, and the header account menu shows **Studio**, **Promotions** *and* **Admin**
- `/designer/products/new` creates a product **including the image upload** (this is the real test
  of step 11 — a 500 here means the asset volume is still root-owned)
- `/designer/promotions` creates a `FEATURED` promotion, and
  `curl -s https://i-yae.com/api/promotions/featured` is no longer `[]`

`www.i-yae.com` now has a Traefik router that redirects to the apex (on the merged branch), so
check it too — it needs its own certificate, issued on first request:

```bash
curl -sI https://www.i-yae.com | head -2     # expect 301 to https://i-yae.com/
```

A `404 page not found` here means the branch was not merged before step 9; a TLS error means
Let's Encrypt has not yet issued for the `www` name — retry in a minute.

---

## 14. Optional: raise Cloudflare to Full (strict)

**Why:** the zone is on **Full**, not strict, so the Cloudflare→origin hop is encrypted but
unauthenticated. Now that Let's Encrypt has issued a real certificate for `i-yae.com` (verified at
step 13), strict mode closes that. Doing it *before* issuance would have made the whole site answer
Cloudflare error 526. Skipping this entirely is acceptable and matches the other apps on this host.

Cloudflare → `i-yae.com` → **SSL/TLS > Overview** → **Full (strict)**.

**Verify:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://i-yae.com/
# expect 200. A 526 means revert to Full immediately and re-check the origin certificate.
```

---

## 15. Prove mail end to end — the check no configuration can replace

**Why:** the transport can connect and authenticate correctly while the relay still refuses to
accept mail for the sending domain, and `transporter.verify()` cannot see that. Registration
returns 201 either way and production gates login on verification, so a failure here means **100%
of signups are permanently stuck**, not some. Use an external mailbox (Gmail/Outlook), not one on
this host.

1. Register a throwaway account through `https://i-yae.com/register`.
2. Confirm the verification email **arrives** (check spam too — a brand-new sending domain has no
   reputation), that `From:` is `noreply@i-yae.com`, and that the link opens `https://i-yae.com/…`.
3. Click it and confirm you can then sign in.
4. Only then grep both containers:

```bash
ssh -i keys/iyae app-iyae@2.24.197.12 'ops logs server' \
  | grep -iE 'Failed to send|EmailDeliveryException|\[mail-canary\]'
ssh -i keys/iyae app-iyae@2.24.197.12 'ops logs web' | grep -i '\[mail\] delivery failed'
```

**Verify:** the email is in the inbox, sign-in works, and both greps print nothing. One
`[mail-canary] … NOT deliverable` line dated within ~90 seconds of a container start is a known
startup-ordering artefact — the canary's first tick can fire before the web container is ready.
Anything later is real. Then:

```bash
curl -s https://i-yae.com/api/health/mail
# expect status UP with a lastSend reflecting the real send you just made, not "never"
```

**Do not announce the site until this passes.**

---

## 16. Take a backup, prove it restores, and run the freshness check on the host

**Why:** a dump that has never been restored is not a backup, and step 10's failure mode is a
sidecar that looks healthy and writes nothing. Do this while the data is still trivial to recreate.

```bash
ssh -i keys/iyae app-iyae@2.24.197.12 'ops backup'
ssh -i keys/iyae app-iyae@2.24.197.12 'ops restore'     # with no argument, lists what exists
```

Expect `ops backup` to print a `mysqldump: Error: … PROCESS privilege(s) … when trying to dump
tablespaces` line. **The dump still succeeds** — the schema is pure InnoDB and that query is
NDB-only. It is noise from the schema-scoped `iyae` user, flagged for a repo fix.

Two separate things are being checked here, and they do **not** corroborate each other:

- `ops backup` writes to `/opt/apps/iyae/backups` — the manual archive.
- the sidecar writes to `/opt/apps/iyae/data/backups/mysql` — the automated daily dump, and the
  **only** one the freshness monitor scans.

```bash
# Must be run ON THE HOST. Run locally it scans a non-existent /opt/apps and uses GNU
# `find -printf`, which macOS does not have — it prints a misleading WARN either way.
ssh ithacaDeploy 'sudo /opt/apps/scripts/check-backup-freshness.sh; echo "exit=$?"'
```

**Verify:** an `OK     iyae/mysql: fresh dump (…)` line. A `STALE  iyae/mysql: no dump files at
all` — or `MISSING iyae/mysql` — means step 10 did not take effect; `iyae/mysql` is now in
`EXPECTED_TARGETS`, so the run exits non-zero rather than quietly omitting the app.

> **Known gap:** the copy of this monitor installed at `/opt/apps/scripts/` may still be the
> 2026-08-20 version, which has none of the `_backups` logic and reports only on `clossette`. If the
> output above does not mention `iyae` at all, that is why — and it means nothing is watching this
> app's backups yet. Re-installing it is `./scripts/setup-server.sh` from the infra checkout, and is
> tracked as a separate pending host task.

Optional but cheap, a real restore test into a throwaway schema:

```bash
ssh ithacaDeploy
DUMP=$(sudo ls -t /opt/apps/iyae/data/backups/mysql/*.tgz | head -1); echo "$DUMP"
sudo docker exec -i iyae-db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -e "CREATE DATABASE iyae_restore_test"'
sudo tar -xzOf "$DUMP" | sudo docker exec -i iyae-db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root iyae_restore_test'
sudo docker exec -i iyae-db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root --batch -e "
  SELECT MAX(version) FROM iyae_restore_test.flyway_schema_history;
  SELECT COUNT(*) FROM iyae_restore_test.users;"'
sudo docker exec -i iyae-db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -e "DROP DATABASE iyae_restore_test"'
```

Expect `MAX(version)` = 26 and at least one user (the bootstrap ADMIN).

---

## 17. Create the monitors — nothing is watching this app

**Why:** `apps/iyae/app.env` sets no `UPTIME_KUMA_URL`, so `provision.sh` step 7/7 printed *"No
UPTIME_KUMA_URL configured — skipping monitoring registration"* and registered nothing at all. This
matters most for mail: `/api/health/mail` was built specifically to answer **503** so an ordinary
HTTP monitor can alarm on it, and the launch runbook records plainly that until someone creates that
monitor by hand, discovering a mail outage means grepping logs. Uptime Kuma only accepts checks
created in its UI.

Create four:

| # | Type | Target | Interval | Accepted codes |
|---|---|---|---|---|
| 1 | HTTP(s) | `https://i-yae.com/api/health/ready` | 60 s | 200–299 |
| 2 | HTTP(s) | `https://i-yae.com/api/health/mail` | 300 s | 200–299 |
| 3 | HTTP(s) | `https://i-yae.com/` with **Certificate Expiry Notification** on | 300 s | 200–299 |
| 4 | TCP Port | `mail.ithacateens.com:465` with **Certificate Expiry Notification** on | 300 s | — |

Attach your existing notification channel to all four.

- **Do not** point a monitor at `https://i-yae.com/` alone as the health check: that is a 200 from
  the marketing homepage and stays green with the database down.
- **Do not** widen monitor 2's accepted codes to include 5xx. The 503 *is* the signal.
- Monitor 4 is the one that would have caught the certificate in step 1 before it became a
  two-day deadline. The merged branch's `/etc/cron.d/cert-expiry` now also catches it, but keep
  this monitor: the cron job alerts by mail and the journal on a host whose MTA is the very thing
  that breaks, while Uptime Kuma alerts out-of-band. They fail independently, which is the point.

### Installing the two host monitors (also fixes the stale copy step 16 warns about)

`setup-server.sh` is what installs them, but it is the **whole** host setup — nine steps including
redeploying Traefik and the mail stack — so do not reach for it just to refresh two files on a
host that is serving traffic. Copy them directly instead:

```bash
cd /Users/jadyn/Development/IthacaServer
scp scripts/check-backup-freshness.sh scripts/check-cert-expiry.sh ithacaDeploy:~/
scp infrastructure/host/cron.d/cert-expiry ithacaDeploy:~/
ssh ithacaDeploy '
  sudo install -o root -g root -m 755 ~/check-backup-freshness.sh /opt/apps/scripts/check-backup-freshness.sh
  sudo install -o root -g root -m 755 ~/check-cert-expiry.sh       /opt/apps/scripts/check-cert-expiry.sh
  sudo install -o root -g root -m 644 ~/cert-expiry                /etc/cron.d/cert-expiry
  rm -f ~/check-backup-freshness.sh ~/check-cert-expiry.sh ~/cert-expiry
'
```

`install` is deliberate rather than `cp` + `chmod`: it sets owner and mode atomically, and
`/etc/cron.d` entries must be root-owned and 644 or cron silently ignores them.

**Verify:**

```bash
ssh ithacaDeploy 'sudo /opt/apps/scripts/check-cert-expiry.sh; echo "exit=$?"'
ssh ithacaDeploy 'sudo /opt/apps/scripts/check-backup-freshness.sh | grep iyae'
# the second must mention iyae/mysql — if it does not, the stale copy is still installed
```

Then create a **Push** monitor, and record its URL in `apps/iyae/app.env` so re-provisioning keeps
registering it:

```
UPTIME_KUMA_URL="<push url from Uptime Kuma>"
```

**Verify:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://i-yae.com/api/health/ready   # 200
curl -s -o /dev/null -w '%{http_code}\n' https://i-yae.com/api/health/mail    # 200
```

and all four monitors green. Prove monitor 1 can actually go red rather than just rendering green:

```bash
ssh ithacaDeploy 'sudo docker stop iyae-db'    # wait two intervals, confirm the monitor goes red
ssh ithacaDeploy 'sudo docker start iyae-db'
```

> **Known gap:** the Uptime Kuma panel may be unreachable from the internet — `*.ops.ithacateens.com`
> had no DNS record as of the 2026-10-16 audit. If so, reach it over a tunnel:
> `ssh -N -L 3001:localhost:3001 ithacaDeploy`, then `http://localhost:3001`. If the container is
> not published on loopback, get its address with
> `ssh ithacaDeploy "sudo docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' uptime-kuma"`.

---

## 18. Make the addresses the site publishes actually receive mail

**Why:** this is *receiving* mail, which is not part of ③ (③ created the sending account only).
`/privacy` publishes `privacy@i-yae.com`, `/terms` and the footer publish `support@i-yae.com`, and
the live DMARC record you published names `postmaster@i-yae.com` as its report target. The MX for
`i-yae.com` is live and resolves to this server (measured), so mail to those addresses reaches
Stalwart — which rejects an unknown recipient for a hosted domain with `550 5.1.1`.

Skipped: every data-subject privacy request and every footer "Contact" click hard-bounces, and
every DMARC aggregate report for a brand-new sending domain is discarded — which is the only
feedback channel that would tell you the DKIM record was pasted correctly.

In the Stalwart admin UI → **Management > Directory > Accounts**:

1. Create **one** real mailbox on the new domain (e.g. `support@i-yae.com`) with a password you
   keep — unlike `noreply@`, this one needs an actual mailbox.
2. On that same account, under **Email addresses**, add as additional addresses:
   - `privacy@i-yae.com`
   - `postmaster@i-yae.com`
   - `noreply@i-yae.com` (optional but recommended — the app sends no `Reply-To`, so replies to
     verification mail otherwise vanish)

   Stalwart treats extra addresses on a principal as aliases; no separate alias object is needed.
   A catch-all `@i-yae.com` on the same account also works — weigh it against spam on a public
   domain.
3. **Do not** attach these to the `noreply@i-yae.com` submission account. That account is
   mailbox-less and revocable on purpose, and giving it inbound aliases means the app's SMTP
   credential can read your inbound mail.

**Verify** — from a mailbox outside this host, send one message to each of `privacy@`, `support@`
and `postmaster@ i-yae.com` and confirm none bounces. Or probe the SMTP conversation directly (no
authentication, nothing is delivered):

```bash
printf 'EHLO probe\r\nMAIL FROM:<probe@example.com>\r\nRCPT TO:<privacy@i-yae.com>\r\nQUIT\r\n' \
  | openssl s_client -quiet -connect mail.ithacateens.com:465 -servername mail.ithacateens.com
# expect a 250 after the RCPT TO. A 550 means that address is not attached to the principal.
```

Then, 24–48 h after step 15's real send, check that mailbox for a DMARC aggregate report (a
`.zip`/`.gz` of XML from `google.com` or `outlook.com`) and confirm it shows `dkim pass` and
`spf pass`. Keep DMARC at `p=none` until you have read a few days of those.

---

# If the deploy fails: how you know, and how to abort

## How you learn it failed

Nothing alerts you until step 17 is done, and two of the obvious signals lie:

- `provision.sh` prints **"Application started"** unconditionally after `up -d`, even if the server
  is crash-looping.
- `validate.sh`'s "Containers running" check passes if **any single** container is Up.
- `https://i-yae.com/` returns 200 from a static marketing page even with the database down — which
  is exactly why `HEALTH_PATH` is `/api/health/ready`.

The signals that do not lie:

```bash
ssh -i keys/iyae app-iyae@2.24.197.12 'ops status'              # all six Up/healthy?
ssh -i keys/iyae app-iyae@2.24.197.12 'ops logs server -n 200'  # the real reason
curl -s -o /dev/null -w '%{http_code}\n' https://i-yae.com/api/health/ready
```

If `iyae-web` and `iyae-nginx` are **absent rather than unhealthy**, the server never passed its
healthcheck — both gate on `server: condition: service_healthy`. Read the server log; it names the
cause.

## Fix forward (almost always the right answer — this will be config, not code)

```bash
ssh -i keys/iyae app-iyae@2.24.197.12 'ops env'            # redacted view of the live .env
ssh -t -i keys/iyae app-iyae@2.24.197.12 'ops env-edit'    # edit + auto-redeploy on change
```

## `ops rollback` will NOT work on a first deploy

It reverts `source/` to `.rollback-ref`, and that file is only written by `ops deploy`.
`provision.sh` starts the stack directly through the compose wrapper and never writes it, so
immediately after a first deploy `ops rollback` exits 1 with *"No rollback state found. Deploy at
least once first."* There is also nothing to roll back **to** — this is a brand-new app with a
brand-new database.

```bash
ssh ithacaDeploy 'sudo cat /opt/apps/iyae/.rollback-ref'   # confirm it exists before relying on it
```

## Full teardown of a first deploy that cannot be salvaged

This destroys IYAE's database and volumes and **touches nothing else on the host** — `clossette`
and the other apps have separate databases, volumes, container names, Traefik routers and ports.

```bash
ssh ithacaDeploy
sudo /opt/apps/.control/iyae/docker-compose-wrapper.sh down
sudo docker volume ls | grep iyae
sudo docker volume rm iyae_assets_data iyae_db-data
```

Keep `/opt/apps/iyae`, `/opt/apps/.control/iyae`, the `app-iyae` user and `keys/iyae` —
`provision.sh` is idempotent over all of them, so re-running after fixing the cause is cheap. Only
remove the user and directories if you are abandoning the app.

```bash
cd /Users/jadyn/Development/IthacaServer && ./scripts/provision.sh iyae   # re-run
```

If you need to take the site offline immediately without destroying anything:

```bash
ssh -i keys/iyae app-iyae@2.24.197.12 'ops stop'
```

Because DNS already points here, that returns the apex to Traefik's bare `404 page not found`
rather than to anything of yours.

---

# What this checklist cannot verify from here

Stated plainly, so you know where you are flying blind:

- **Stalwart's TLS certificate paths** (step 1). Its configuration is in a Docker volume, not in
  either repo. You must read them from the admin UI or the container.
- **Whether `/opt/apps/scripts/check-backup-freshness.sh` on the host is current** (step 16). The
  2026-10-16 audit records it as still the 2026-08-20 copy. The command in step 16 tells you which
  one you have.
- **The host's Docker `default-address-pools`** — elided in the audit. If it sits outside
  `172.16.0.0/12`, the per-IP rate limiting degrades further than step 6 describes (to one bucket
  for the entire instance). Visible only on the host, in `/etc/docker/daemon.json`.
- **Deliverability.** A domain with no sending reputation can land in spam at Gmail and Outlook with
  a perfect SPF/DKIM/DMARC setup. `ithacateens.com` working does not transfer — reputation is
  per-domain as well as per-IP. Step 18's DMARC reports are how you will find out.
- **Whether the live Cloudflare "Always Use HTTPS" / page-rule set has anything else in it.** Only
  the dashboard shows that.
- Every measurement in this file was taken on **2026-10-18 22:35 UTC**. Re-run the commands rather
  than trusting the quoted output, especially fact A.
