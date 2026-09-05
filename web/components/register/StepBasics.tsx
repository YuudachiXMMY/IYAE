"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { RegisterRequest } from "@/lib/api";

interface StepBasicsProps {
  data: Partial<RegisterRequest>;
  onChange: (updates: Partial<RegisterRequest>) => void;
}

export function StepBasics({ data, onChange }: StepBasicsProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-foreground">Let&apos;s get started</h2>
        <p className="text-sm text-muted-foreground mt-1">Your account basics</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={data.email ?? ""}
          onChange={(e) => onChange({ email: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
        <Input
          id="password"
          type="password"
          placeholder="At least 8 characters"
          value={data.password ?? ""}
          onChange={(e) => onChange({ password: e.target.value })}
          required
          minLength={8}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Full Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          id="name"
          type="text"
          placeholder="Your name"
          value={data.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input
          id="username"
          type="text"
          placeholder="@yourhandle"
          value={data.username ?? ""}
          onChange={(e) => onChange({ username: e.target.value })}
        />
      </div>

      <div className="space-y-3">
        <Label>I am a... <span className="text-destructive">*</span></Label>
        <RadioGroup
          value={data.role ?? "BUYER"}
          onValueChange={(v) => onChange({ role: v as "BUYER" | "DESIGNER" })}
          className="space-y-2"
        >
          <div className="flex items-center space-x-3 rounded-xl border border-border p-4 cursor-pointer hover:border-brand/40 transition-colors">
            <RadioGroupItem value="BUYER" id="role-buyer" />
            <Label htmlFor="role-buyer" className="font-normal cursor-pointer">
              <span className="font-medium">Shopper</span>
              <span className="text-muted-foreground block text-xs mt-0.5">Discover and try on fashion with AI styling</span>
            </Label>
          </div>
          <div className="flex items-center space-x-3 rounded-xl border border-border p-4 cursor-pointer hover:border-brand/40 transition-colors">
            <RadioGroupItem value="DESIGNER" id="role-designer" />
            <Label htmlFor="role-designer" className="font-normal cursor-pointer">
              <span className="font-medium">Designer</span>
              <span className="text-muted-foreground block text-xs mt-0.5">Sell your independent creations</span>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
