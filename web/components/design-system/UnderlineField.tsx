"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface UnderlineFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

/**
 * Underline-only form field (label above + bottom-border input). Used in the
 * login, register, and AI-stylist forms.
 */
export const UnderlineField = React.forwardRef<
  HTMLInputElement,
  UnderlineFieldProps
>(({ label, id, className, ...props }, ref) => {
  return (
    <div className={cn("w-full", className)}>
      <label
        htmlFor={id}
        className="block text-[12px] text-muted-foreground mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        className="w-full border-0 border-b border-foreground bg-transparent rounded-none px-0 py-2 text-[15px] focus:outline-none focus:border-brand"
        {...props}
      />
    </div>
  );
});
UnderlineField.displayName = "UnderlineField";
