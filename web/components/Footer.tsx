import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="font-display text-lg text-foreground">IYAE</p>
          <div className="flex gap-6">
            <Link href="/products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Browse
            </Link>
            <Link href="/design" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              For Designers
            </Link>
            <Link href="/status" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Status
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} IYAE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
