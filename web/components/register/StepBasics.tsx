"use client";

import { useState } from "react";
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
}

function splitName(name: string | undefined): [string, string] {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  const [first, ...rest] = parts;
  return [first, rest.join(" ")];
}

export function StepBasics({ data, onChange }: StepBasicsProps) {
  // First/last are presentational; they compose into the single `name` payload field.
  const [initialFirst, initialLast] = splitName(data.name);
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [agreed, setAgreed] = useState(false);

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

          <label className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              className="mt-0.5"
            />
            <span className="font-body text-[13px] leading-relaxed text-muted-foreground">
              I agree to {BRAND.name}&apos;s Terms and Privacy Policy.
            </span>
          </label>
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
