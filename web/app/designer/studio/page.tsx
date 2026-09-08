"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/design-system/SiteHeader";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRequireAuth } from "@/lib/hooks/useRequireAuth";
import { ArrowLeft } from "@phosphor-icons/react";

function QuickCard({
  href,
  icon,
  title,
  description,
  variant = "default",
  className,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  variant?: "default" | "featured";
  className?: string;
}) {
  const isFeatured = variant === "featured";

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col justify-between gap-4 rounded-card p-6 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]",
        isFeatured
          ? "bg-foreground text-background shadow-heavy"
          : "bg-card text-foreground shadow-soft hover:shadow-md",
        className
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
          isFeatured
            ? "bg-background/15 text-background group-hover:bg-background/25"
            : "bg-brand/10 text-brand group-hover:bg-brand group-hover:text-primary-foreground"
        )}
      >
        {icon}
      </div>
      <div>
        <p className={cn("text-lg font-semibold", isFeatured ? "text-background" : "text-foreground")}>
          {title}
        </p>
        <p className={cn("mt-1 text-sm", isFeatured ? "text-background/70" : "text-muted-foreground")}>
          {description}
        </p>
      </div>
    </Link>
  );
}

export default function DesignerStudioPage() {
  const { user, loading } = useRequireAuth("DESIGNER");

  if (loading) {
    return (
      <>
        <SiteHeader variant="app" />
        <PageShell>
          <div className="flex flex-col gap-10">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-48 w-full rounded-card" />
          </div>
        </PageShell>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <SiteHeader variant="app" />
      <PageShell>
        <div className="flex flex-col gap-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft size={16} weight="bold" />
            Back to Profile
          </Link>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">Designer</Badge>
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
            <h1 className="font-display text-5xl font-semibold -tracking-[0.02em] text-foreground sm:text-6xl">
              {user.name ? `Welcome back, ${user.name}` : "Your Studio"}
            </h1>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <div className="sm:col-span-3">
              <QuickCard
                href="/designer/products"
                title="My Products"
                description="View and manage all your listed products."
                variant="featured"
                className="h-full"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Products">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M3 9h18M3 15h18M9 3v18" />
                  </svg>
                }
              />
            </div>
            <div className="flex flex-col gap-4 sm:col-span-2">
              <QuickCard
                href="/designer/products/new"
                title="Create Product"
                description="List a new piece from your collection."
                className="flex-1"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="New Product">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v8M8 12h8" />
                  </svg>
                }
              />
              <QuickCard
                href="/design"
                title="Design Hub"
                description="Explore 3D capabilities and brand resources."
                className="flex-1"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Design">
                    <path d="M12 2 2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>
      </PageShell>
      <Footer />
    </>
  );
}
