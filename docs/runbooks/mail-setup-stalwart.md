# Mail setup — adding `i-yae.com` as a sending domain in Stalwart

Operator steps for the live host. **Everything here is done by hand**: Stalwart's domains, DKIM
keys and credentials live in its admin UI and its own data volume, not in either git repo.

Scope is **send-only** — verification and password-reset mail. No mailbox, no IMAP, no receiving.

What you hand back when you're done: the SMTP username, its app password, and the exact name on
the mail server's TLS certificate. Those three go into the deployment; nothing else is needed.

---

## What already exists (so you don't rebuild it)

Stalwart v0.16 is already deployed and four other apps already relay through it.

| | |
|---|---|
| Admin UI | `https://mail.ithacateens.com` (Traefik-proxied, container port 8080) |
| Admin credentials | `admin` + the password in `infrastructure/mail/.env` as `STALWART_ADMIN_CREDENTIALS`, also recorded in IthacaServer's local `.credentials` |
| Existing sending domain | `ithacateens.com` |
| Ports published | 25, 465, 587, 993 — **direct**, not through Traefik (deliberate: preserves the real client IP) |
| **Working submission port** | **465** (implicit TLS). 587 is published but STARTTLS is **not** enabled on it — it answers `ECONNREFUSED`. |
| Firewall | UFW already allows 25/465/587/993; outbound unrestricted |

> ### Do not touch this setting
> **Settings > Network > "Trusted networks"** (`server.proxy.trusted-networks`). Putting the
> Docker subnet there marks it as a *reverse proxy* and makes Stalwart require the PROXY protocol
> on every connection from it — which is every app and Traefik. The admin UI then returns 502 and
> SMTP connections get reset, **but only after the next container restart**, so the breakage looks
> unrelated to the change that caused it. For relay trust use the allow-list in step 3 or an
> authenticated account instead.

---

## Step 1 — Add `i-yae.com` as a domain

Admin UI → **Management > Directory > Domains** → add `i-yae.com`.

Stalwart generates a DKIM keypair for the domain at this point and shows you the TXT records to
publish. **Copy them now** — you need them in step 4. The private half stays inside Stalwart and
is never displayed again.

> `i-yae.com` is a *second* sending domain alongside `ithacateens.com`. Adding it does not affect
> the existing one or the four apps using it.

## Step 2 — Create the submission account

**Management > Directory > Accounts** → create a dedicated account for this app, e.g.
`noreply@i-yae.com`.

- Give it an **app password**, not a login password you reuse anywhere.
- Grant it submission/authenticated-relay only. It does not need a mailbox, IMAP, or admin rights.
- A dedicated account is the point: it can be revoked for this one sender without disturbing
  the other four services sharing this mail server.

Record the username and the app password. These are the two values I need back.

## Step 3 — Confirm the app can relay for the domain

Submission with a valid account for `i-yae.com` should be accepted without further configuration.
If sends are rejected with a relay error, check **Settings > SMTP > Inbound** → `session.rcpt.relay`
and make sure authenticated sessions are permitted to relay. (Again: not via Trusted networks.)

## Step 4 — Publish DNS for `i-yae.com`

You need DNS control for `i-yae.com`. The server IP is the one recorded in IthacaServer's
`docs/audit-2026-08-20.md` — that file warns it must not be made public, so take the value from
there rather than from anywhere else.

| Type | Name | Value | Why |
|---|---|---|---|
| TXT | `i-yae.com` | `v=spf1 ip4:<SERVER_IP> -all` | Authorizes the host to send as this domain. Pins the IP rather than using `a`/`mx`, which is what makes it correct even if the A record is proxied. |
| TXT | `<selector>._domainkey.i-yae.com` | *(from step 1)* | DKIM. This is the one that gives DMARC alignment — see the note below. |
| TXT | `_dmarc.i-yae.com` | `v=DMARC1; p=none; rua=mailto:dmarc@<a-domain-you-can-receive-at>` | Start at `p=none` and watch the reports before tightening to `quarantine`/`reject`. |

### The alignment detail that matters for a second domain

The mail server's own identity — its PTR record and the name it uses in `HELO` — is
`mail.ithacateens.com`, and that does **not** change. Mail from `noreply@i-yae.com` therefore
passes DMARC on **DKIM alignment** (`d=i-yae.com` matching the `From:` domain), not on the HELO
name. So the DKIM record in step 1 is not optional here the way it might be for the first domain
on a server — without it, `i-yae.com` mail has no aligned identifier and DMARC fails.

You do **not** need an MX record on `i-yae.com` to send. Two caveats if you skip it:

- **Bounces go nowhere.** A rejected message bounces to the envelope sender; with no MX on
  `i-yae.com` that bounce is undeliverable and you lose the diagnostic.
- **DMARC reports go nowhere** unless `rua=` points at an address you can actually receive at —
  which is why the table above suggests a domain you already receive on.

Adding `MX 10 mail.ithacateens.com` on `i-yae.com` fixes both and costs nothing. Recommended.

### If `i-yae.com` is on Cloudflare

Any `mail.*` A record must be **DNS-only (grey cloud)**. Cloudflare's proxy carries HTTP, not
SMTP, and a proxied record hands back anycast IPs, which breaks the IP → PTR → SPF chain. The
existing `mail.ithacateens.com` is presumably already set this way; check with
`dig mail.ithacateens.com` and match it.

## Step 5 — Find the certificate name

I need the exact name on the certificate Stalwart presents on 465, because the app connects to it
by an internal container name that cannot match that certificate. Rather than switching
certificate verification off — which is what the other four apps do — the app uses SNI to verify
the *right* name while still connecting internally.

```bash
openssl s_client -connect mail.ithacateens.com:465 -servername mail.ithacateens.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName
```

Report the `DNS:` name(s) it prints. Expected `mail.ithacateens.com`; if Stalwart has since
obtained a certificate covering `mail.i-yae.com` too, say so — that changes which name we verify.

## Step 6 — Verify before handing back

```bash
# DNS is published and resolves
dig +short TXT i-yae.com
dig +short TXT _dmarc.i-yae.com
dig +short TXT <selector>._domainkey.i-yae.com

# The submission port answers (it should; 587 will not)
openssl s_client -connect mail.ithacateens.com:465 -crlf </dev/null 2>&1 | head -5
```

Then a real deliverability check, which is worth doing *before* the app depends on it: send one
message as the new account to the address https://www.mail-tester.com/ gives you, and aim for 9+.
It scores SPF, DKIM, DMARC, PTR and blacklist status in one pass. Also worth a look:
https://mxtoolbox.com/blacklists.aspx against the server IP.

---

## Hand back to me

1. `SMTP_USER` — the account from step 2 (e.g. `noreply@i-yae.com`)
2. `SMTP_PASSWORD` — its app password
3. `SMTP_TLS_SERVERNAME` — the certificate name from step 5
4. Confirmation that step 6's DNS lookups return values, and the mail-tester score

`SMTP_HOST` is `stalwart` (the container name) and `SMTP_PORT` is `465`; I already have those.
`MAIL_FROM` will be `noreply@i-yae.com`.

**Do not paste the app password into a chat or a tracked file.** It belongs in
`apps/clossette/.env.extra` in the IthacaServer repo, which is gitignored and appended to the
server's `.env` at provision time. Tell me it is set and I will wire the variable names.

---

## One risk worth stating plainly

Self-hosting transactional mail on an IP with no sending reputation for this domain means the
first verification emails may land in spam at Gmail and Outlook regardless of a perfect SPF/DKIM/
DMARC setup. The existing `ithacateens.com` mail working is encouraging but is not transferable —
reputation is per-domain as well as per-IP.

Mitigations, in order of effort: start `p=none` and read the DMARC aggregate reports; warm the
domain by sending low volume first; and keep the mail-tester score at 9+. If verification
deliverability turns out to be bad after launch, the fallback that does not undo any of this work
is to point Stalwart at a reputable smarthost as a relay — the app's configuration does not
change, only Stalwart's outbound route.
