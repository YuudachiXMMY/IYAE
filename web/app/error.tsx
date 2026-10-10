"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-4xl text-foreground mb-4">
        Something went wrong
      </h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        We encountered an unexpected error. Please try again or contact support
        if the issue persists.
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-brand-hover transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
