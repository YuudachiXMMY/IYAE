"use client";

import { cn } from "@/lib/utils";

type HeadingTag = "h1" | "h2" | "h3" | "h4";

interface EditorialHeadingProps {
  children: React.ReactNode;
  as?: HeadingTag;
  className?: string;
}

export function EditorialHeading({
  children,
  as: Tag = "h2",
  className,
}: EditorialHeadingProps) {
  return (
    <Tag
      className={cn(
        "font-display text-[32px] sm:text-[40px] lg:text-[48px] leading-tight text-foreground",
        className
      )}
    >
      {children}
    </Tag>
  );
}
