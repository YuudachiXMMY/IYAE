"use client";

import { useState } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { EditorialHeading } from "@/components/design-system/EditorialHeading";
import { UnderlineField } from "@/components/design-system/UnderlineField";
import { FilterPill } from "@/components/design-system/FilterPill";
import { AbstractForm } from "@/components/design-system/AbstractForm";
import { BRAND } from "@/lib/brand";
import type { RegisterRequest } from "@/lib/api";

interface StepBasicsProps {
  data: Partial<RegisterRequest>;
  onChange: (updates: Partial<RegisterRequest>) => void;
  /**
   * Terms/Privacy consent, owned by the wizard rather than by this step.
   *
   * It is a separate prop instead of a field on `data` because `RegisterRequest` is the API
   * payload shape and the server has no consent column — putting it there would imply it gets
   * sent. It has to leave this component either way: while `agreed` was local `useState`, the
   * only readers were its own declaration and the `checked` prop, so the box gated nothing and
   * an account could be created without ever ticking it.
   */
  agreed: boolean;
  onAgreedChange: (agreed: boolean) => void;
}

function splitName(name: string | undefined): [string, string] {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  const [first, ...rest] = parts;
  return [first, rest.join(" ")];
}

export function StepBasics({ data, onChange, agreed, onAgreedChange }: StepBasicsProps) {
  // First/last are presentational; they compose into the single `name` payload field.
  const [initialFirst, initialLast] = splitName(data.name);
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);

  function commitName(first: string, last: string) {
    const composed = `${first} ${last}`.trim();
    onChange({ name: composed });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_220px]">
      <div className="space-y-8">
        <div>
          <EditorialHeading>Create your account.</EditorialHeading>
          <p className="mt-3 font-body text-[15px] text-muted-foreground">
            A few basics, then we&apos;ll tailor {BRAND.name} to your style.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <UnderlineField
              label="First name"
              id="firstName"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                commitName(e.target.value, lastName);
              }}
            />
            <UnderlineField
              label="Last name"
              id="lastName"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                commitName(firstName, e.target.value);
              }}
            />
          </div>

          <UnderlineField
            label="Email address"
            id="email"
            type="email"
            autoComplete="email"
            value={data.email ?? ""}
            onChange={(e) => onChange({ email: e.target.value })}
            required
          />

          <UnderlineField
            label="Create password"
            id="password"
            type="password"
            autoComplete="new-password"
            value={data.password ?? ""}
            onChange={(e) => onChange({ password: e.target.value })}
            required
            minLength={8}
          />

          <UnderlineField
            label="Username (optional)"
            id="username"
            type="text"
            autoComplete="username"
            value={data.username ?? ""}
            onChange={(e) => onChange({ username: e.target.value })}
          />

          <div className="space-y-3">
            <p className="font-body text-[12px] text-muted-foreground">I am a…</p>
            <div className="flex gap-2">
              <FilterPill
                active={(data.role ?? "BUYER") === "BUYER"}
                onClick={() => onChange({ role: "BUYER" })}
              >
                Shopper
              </FilterPill>
              <FilterPill
                active={data.role === "DESIGNER"}
                onClick={() => onChange({ role: "DESIGNER" })}
              >
                Designer
              </FilterPill>
            </div>
          </div>

          {/* The links are siblings of the <label>, not inside it. A <label> forwards any
              click in it to its control, so links nested there would tick the consent box as
              a side effect of opening the document — consenting on the user's behalf to
              something they were in the act of going to read. The label still wraps the
              checkbox and the plain prose, so that text remains a valid click target. */}
          {/* One wrapping text flow, not two flex items. The checkbox is a flex sibling of a
              single <span> that holds the whole sentence, so "I agree to IYAE's" and "Terms and
              Privacy Policy." wrap as one sentence on a narrow viewport instead of being laid
              out as two columns that can break mid-sentence. */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={agreed}
              onCheckedChange={(v) => onAgreedChange(v === true)}
              aria-describedby="terms-documents"
              className="mt-0.5"
            />
            <span className="font-body text-[13px] leading-relaxed text-muted-foreground">
              {/* Only the plain prose is inside the <label>; the links sit outside it. A label
                  forwards every click within it to its control — whether it wraps the control or
                  uses htmlFor — so a link nested there would tick the consent box as a side
                  effect of opening the document, consenting on the user's behalf to the very
                  thing they were going to read. The links are instead reachable to assistive
                  tech through aria-describedby on the checkbox. */}
              <label htmlFor="terms">I agree to {BRAND.name}&apos;s</label>{" "}
              {/* These were plain text until the documents existed, so the box consented to
                  nothing readable — on a product whose core data is body measurements. */}
              <span id="terms-documents">
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline hover:no-underline"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline hover:no-underline"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Decorative editorial panel (desktop only) */}
      <aside className="relative hidden lg:block">
        <AbstractForm
          tint={25}
          rounded="rounded-[48px]"
          className="h-full min-h-[420px] w-full motion-safe:animate-[editorial-float_12s_ease-in-out_infinite]"
        />
        <p className="absolute bottom-6 left-6 right-6 font-display text-[20px] leading-tight text-foreground">
          Made to fit real lives.
        </p>
      </aside>
    </div>
  );
}
