"use client";

import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

export default function CheckoutCancelPage() {
  return (
    <>
      <NavBar />
      <PageShell>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          {/* X icon */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
              aria-label="Payment cancelled"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>

          <h1 className="font-display text-4xl font-semibold text-foreground sm:text-5xl">
            Payment Cancelled
          </h1>
          <p className="mt-4 max-w-sm text-base text-muted-foreground">
            No worries — your cart is still saved. You can return whenever
            you&apos;re ready to complete your purchase.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/cart">
              <Button className="rounded-full bg-brand px-8 text-white hover:bg-brand-hover">
                Return to Cart
              </Button>
            </Link>
            <Link href="/products">
              <Button
                variant="outline"
                className="rounded-full border-border px-8"
              >
                Continue Browsing
              </Button>
            </Link>
          </div>
        </div>
      </PageShell>
      <Footer />
    </>
  );
}
