import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-6xl text-foreground mb-4">404</h1>
      <h2 className="font-display text-2xl text-muted-foreground mb-6">
        Page not found
      </h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Let&apos;s get you back on track.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-brand-hover transition-colors"
        >
          Go Home
        </Link>
        <Link
          href="/products"
          className="rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground hover:border-foreground/30 transition-colors"
        >
          Browse Products
        </Link>
      </div>
    </div>
  );
}
