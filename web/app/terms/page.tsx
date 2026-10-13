"use client";

// Companion to /privacy. Registration requires agreeing to "Terms and Privacy Policy" and
// neither document existed, so the checkbox consented to nothing.
//
// ENGINEERING-AUTHORED and not reviewed by counsel. Decided 2026-10-11: ships as-is for launch
// #1 rather than blocking on a legal review. It is accurate about how the product behaves today
// — including that payment is disabled and that the AI stylist's suggestions are not
// professional advice — which is the part that matters for a checkbox the user has to tick.
// A counsel pass is still worth doing; it is not a release blocker.
//
// The "Buying" section below describes payment as disabled. That has to change in the same
// commit that enables checkout.

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

export default function TermsPage() {
  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <article className="mx-auto max-w-2xl pb-16">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>

          <Section title="Your account">
            <p>
              You need an account to use most of {BRAND.name}. Keep your password to yourself, use
              a real email address you can receive mail at — you will need it to verify the
              account — and tell us if you think someone else has access.
            </p>
            <p>
              You must be 16 or older to create an account.
            </p>
          </Section>

          <Section title="Fit and size recommendations">
            <p>
              Size recommendations and the virtual try-on are estimates generated from the
              measurements you enter and from measurements supplied by designers. They are a guide,
              not a guarantee of fit. Check the garment&apos;s own size chart before you buy.
            </p>
          </Section>

          <Section title="The AI stylist">
            <p>
              The stylist is an automated system. Its suggestions are generated, sometimes wrong,
              and are not professional advice of any kind. Use your own judgement.
            </p>
          </Section>

          <Section title="Buying">
            <p>
              <strong className="text-foreground">Payment is currently disabled.</strong>{" "}
              {BRAND.name} is not accepting orders at the moment, and checkout is turned off
              across the site. When it opens, these terms will be updated with the payment,
              shipping, return and refund terms that apply, and prices shown at checkout will be
              the amounts charged.
            </p>
          </Section>

          <Section title="Selling and pre-loved listings">
            <p>
              If you list an item — as a designer or as a seller of something you own — you are
              responsible for describing it accurately, for having the right to sell it, and for
              the images you upload. Do not upload images you do not own the rights to.
            </p>
            <p>
              We may hide or remove a listing that is inaccurate, unsafe, infringing, or against
              these terms.
            </p>
          </Section>

          <Section title="Community conduct">
            <p>
              The community exists so people can share what they wear. Do not post harassment,
              hate, sexual content involving minors, spam, other people&apos;s private
              information, or content you do not have the rights to.
            </p>
            <p>
              You can report a post from the post itself. We may remove content and suspend
              accounts that break these rules. You keep ownership of what you post, and you give
              us permission to display it within {BRAND.name}.
            </p>
          </Section>

          <Section title="Ending your account">
            <p>
              You can delete your account at any time from your profile settings; what happens to
              your data is described in the{" "}
              <Link className="text-brand hover:underline" href="/privacy">
                Privacy Policy
              </Link>
              . We may suspend or close an account that breaks these terms.
            </p>
          </Section>

          <Section title="The service as it is">
            <p>
              {BRAND.name} is provided as it is. We do not promise it will be uninterrupted or
              error-free, and features may change. We are not liable for indirect or incidental
              losses arising from using it, to the extent the law allows.
            </p>
          </Section>

          <Section title="Changes and contact">
            <p>
              If we change these terms in a way that matters, we will say so on this page and
              update the date above. Questions go to{" "}
              <a
                className="text-brand hover:underline"
                href={`mailto:support@${new URL(BRAND.url).hostname}`}
              >
                support@{new URL(BRAND.url).hostname}
              </a>
              .
            </p>
          </Section>
        </article>
      </PageShell>
      <Footer />
    </>
  );
}
