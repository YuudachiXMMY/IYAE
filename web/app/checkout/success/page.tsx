"use client";

import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { PageShell } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccessPage() {
  return (
    <>
      <NavBar />
      <PageShell>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          {/* Checkmark icon */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
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
              className="text-green-600"
              aria-label="Order confirmed"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="font-display text-4xl font-semibold text-foreground sm:text-5xl">
            Order Confirmed!
          </h1>
          <p className="mt-4 max-w-sm text-base text-muted-foreground">
            Thank you for your purchase. We&apos;ve received your order and
            will begin processing it right away.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/orders">
              <Button className="rounded-full bg-brand px-8 text-white hover:bg-brand-hover">
                View My Orders
              </Button>
            </Link>
            <Link href="/products">
              <Button
                variant="outline"
                className="rounded-full border-border px-8"
              >
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </PageShell>
      <Footer />
    </>
  );
}
