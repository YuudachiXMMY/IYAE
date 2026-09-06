# Checkout Dark-Pattern Audit

Phase 9 hardening deliverable. IYAE's checkout must stay free of manipulative
("dark") patterns. This checklist is the standing contract; the e2e assertions in
`web/e2e/checkout-flow.spec.ts` guard the most testable items against regression.

**Scope:** `web/app/cart/page.tsx`, `web/app/checkout/page.tsx`,
`web/app/checkout/success/page.tsx`, `web/app/checkout/cancel/page.tsx`, and the
server checkout path (`CheckoutService`, `CheckoutController`, `StripeWebhookController`).

## Checklist

| # | Pattern to avoid | Requirement | Status | Evidence |
|---|---|---|---|---|
| 1 | **Sneaking / pre-checked opt-ins** | No checkbox (newsletter, add-on, insurance, donation) is checked by default; there are no pre-selected add-ons | ✅ PASS | `checkout/page.tsx` has no `<input type="checkbox">` at all; the only inputs are the "Place Order" button and cart quantity controls |
| 2 | **Hidden fees / drip pricing** | Every charge is itemized before payment; no fee appears only at the last step | ✅ PASS | `checkout/page.tsx` renders an itemized Subtotal + Taxes + Shipping + Total block; taxes/shipping are explicitly labelled "Calculated at payment" rather than silently omitted (`checkout-subtotal` / `checkout-total` test ids) |
| 3 | **Forced continuity / hidden subscription** | Purchase is one-time; no recurring charge or auto-renewing plan is created | ✅ PASS | `CheckoutService.initiateCheckout` builds a Stripe `mode: PAYMENT` session (one-time), never `SUBSCRIPTION`; disclosure copy states "No subscriptions or recurring charges are added" |
| 4 | **Fake urgency / scarcity** | No countdown timers, "only N left", "expires in", or fabricated stock/urgency messaging on cart or checkout | ✅ PASS | Neither `cart/page.tsx` nor `checkout/page.tsx` contains countdown timers or scarcity copy; the e2e spec asserts no `mm:ss` / "only N left" / "hurry" / "expires in" text |
| 5 | **Confirmshaming** | Decline/cancel actions use neutral language, not guilt ("No thanks, I hate saving money") | ✅ PASS | Cancel path is a plain `/checkout/cancel` route; the cart→checkout CTA is neutral ("Proceed to Checkout" / "Place Order") |
| 6 | **Misdirection / disguised ads** | AI-recommended ("demo") items are clearly labelled and visually separated, never slipped into the paid subtotal without disclosure | ✅ PASS | `checkout/page.tsx` renders demo items under an explicit "AI recommendations" heading, visually separated from server cart items |
| 7 | **Trick wording on the primary CTA** | The confirm button plainly states the action and does not obscure that money will be charged | ✅ PASS | Button reads "Place Order" (→ "Processing…"); terms line discloses payment + tax/shipping timing |
| 8 | **Displayed total ≠ charged total** | The Total shown at review equals the amount actually charged for the listed items | ✅ PASS | `grandTotal` (sum of server + demo line items) is shown as both Subtotal and Total and is the same value used to build the order |

## Re-audit trigger

Re-run this audit whenever the checkout or cart UI changes, a new add-on/upsell is
introduced, or the Stripe session mode/line items change. Update the Status column and
extend `web/e2e/checkout-flow.spec.ts` for any newly-testable item.

## Automated guards

`web/e2e/checkout-flow.spec.ts` asserts (items 1, 2, 4, 8):
- no checkbox is checked by default on the checkout page;
- no fake-urgency copy (`/only \d+ left|hurry|expires in|\d+:\d+/i`) is present;
- an itemized Total is shown and equals the subtotal of the listed items.
