"use client";

// Written from what this codebase actually does, not from a template: the data classes below
// correspond to real tables and real outbound calls (body_profiles, avatar_generation_tasks,
// chat_messages, orders, analytics_events; Resend, the configured AI provider, Stripe, the 3D
// generation provider). It exists because registration gates on consent to a privacy policy
// and a terms document that did not exist — the footer linked both to href="#" — on a product
// whose core data is body measurements and 3D body meshes.
//
// ENGINEERING-AUTHORED. It is accurate about the system, but it is not legal advice and has not
// been reviewed by counsel. Have a lawyer review it before launch, and keep it in step with the
// code: if a new third party starts receiving user data, it belongs in the table below.

import Link from "next/link";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { BRAND } from "@/lib/brand";

const LAST_UPDATED = "11 October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <article className="mx-auto max-w-2xl pb-16">
          <h1 className="font-display text-3xl font-semibold text-foreground">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>

          <Section title="What we collect">
            <p>
              <strong className="text-foreground">Account details.</strong> Your email address and
              name, and — if you choose to set them — a username, your city, and an age range.
              Email and name are required to create an account; the rest is optional.
            </p>
            <p>
              <strong className="text-foreground">Body measurements.</strong> Height, weight and
              the circumference measurements you enter for fit and size recommendation. This is
              the most sensitive data {BRAND.name} holds. We use it to generate a 3D body model
              for virtual try-on and to recommend sizes. We do not sell it and we do not use it
              for advertising.
            </p>
            <p>
              <strong className="text-foreground">Your 3D body model.</strong> Generated from your
              measurements. It is stored as a file on our server and is served only to you, over
              an authenticated request. It is not reachable by a public URL.
            </p>
            <p>
              <strong className="text-foreground">Style preferences.</strong> Aesthetics, fit
              preferences, colours you like and avoid, budget range, brands, and outfit goals.
            </p>
            <p>
              <strong className="text-foreground">Conversations with the AI stylist.</strong> The
              messages you send and the replies you receive are stored so you can return to a
              conversation.
            </p>
            <p>
              <strong className="text-foreground">Orders.</strong> What you bought, the size, the
              amount, and your chosen delivery or pickup option.
            </p>
            <p>
              <strong className="text-foreground">Things you post.</strong> Community posts,
              comments, likes, follows, saved looks, your wishlist, product reviews, resale
              listings, and any images you upload.
            </p>
            <p>
              <strong className="text-foreground">Usage events.</strong> Coarse product analytics
              — that a checkout began, that an outfit was generated — tied to your account id so
              we can measure whether features work.
            </p>
          </Section>

          <Section title="Who else sees it">
            <p>
              We use a small number of service providers. Each one receives only what it needs to
              do its job:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Email delivery (Resend).</strong> Your email
                address and name, to send verification and password-reset messages.
              </li>
              <li>
                <strong className="text-foreground">The AI stylist provider.</strong> Your chat
                messages and the style and fit details relevant to the request are sent to a
                third-party large-language-model provider to generate a reply. Treat the stylist
                as you would any online chat: do not paste anything into it you would not want
                leaving {BRAND.name}.
              </li>
              <li>
                <strong className="text-foreground">Payment (Stripe).</strong> When payment is
                enabled, Stripe handles the card transaction and receives the order amount and
                line items. We never see or store your card number.
              </li>
              <li>
                <strong className="text-foreground">3D model generation.</strong> Garment images
                uploaded by designers are sent to a third-party 3D generation service. Your body
                measurements are <em>not</em> sent to it — your body model is generated on our own
                infrastructure.
              </li>
            </ul>
            <p>
              We do not sell personal data, and we do not share it with advertisers.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              Account data and the content you create are kept while your account exists. Order
              records are kept after an account is deleted, because they are financial records we
              are required to retain — but they are stripped of the details that identify you.
            </p>
          </Section>

          <Section title="Deleting your data">
            <p>
              You can delete everything at two levels:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Just the body data.</strong> Your profile
                settings offer a one-tap delete of your measurements and your 3D body model,
                including the generated file on disk. Your account stays.
              </li>
              <li>
                <strong className="text-foreground">The whole account.</strong> Deleting your
                account removes your measurements, body model, chat transcripts, posts, comments,
                likes, follows, saved looks, wishlist, reviews, resale listings, cart and usage
                events. Your name, email, username, city and preferences are erased from your
                account record, and any sessions you have open stop working immediately. Order
                records remain, de-identified, for the accounting reason above.
              </li>
            </ul>
            <p>Deletion is immediate and cannot be undone.</p>
          </Section>

          <Section title="Security">
            <p>
              Passwords are stored only as bcrypt hashes. Traffic is served over HTTPS. Your 3D
              body model and your measurements are returned only to your own authenticated
              session.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy, or a request about your data, can go to{" "}
              <a className="text-brand hover:underline" href={`mailto:privacy@${new URL(BRAND.url).hostname}`}>
                privacy@{new URL(BRAND.url).hostname}
              </a>
              .
            </p>
            <p>
              See also our{" "}
              <Link className="text-brand hover:underline" href="/terms">
                Terms of Service
              </Link>
              .
            </p>
          </Section>
        </article>
      </PageShell>
      <Footer />
    </>
  );
}
