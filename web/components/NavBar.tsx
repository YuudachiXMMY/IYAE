"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { useProfileSurface } from "@/lib/profile-surface";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShoppingCart,
  List,
  User as UserIcon,
  Package,
  Heart,
  GearSix,
  Storefront,
  Megaphone,
  ShieldCheck,
  SignOut,
} from "@phosphor-icons/react";

interface NavBarProps {
  className?: string;
}

function NavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "text-sm transition-colors",
        isActive
          ? "font-medium text-brand"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
      {initials}
    </div>
  );
}

export function NavBar({ className }: NavBarProps) {
  const { user, logout } = useAuth();
  const { surface } = useProfileSurface();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = surface.displayName ?? user?.name ?? null;
  const isDesigner = user?.role === "DESIGNER";
  const isAdmin = user?.role === "ADMIN";

  const handleMouseEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setProfileOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => setProfileOpen(false), 300);
  }, []);

  const handleSignOut = useCallback(() => {
    setProfileOpen(false);
    logout();
    router.push("/");
  }, [logout, router]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="font-display text-2xl font-semibold text-foreground"
        >
          {BRAND.name}
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <>
              <NavLink href="/products">Products</NavLink>
              <NavLink href="/resale">Pre-loved</NavLink>
              <NavLink href="/community">Community</NavLink>
              <NavLink href="/style-lab">Style Lab</NavLink>
              {/* <NavLink href="/orders">Orders</NavLink> */}
              {isDesigner && (
                <>
                  <NavLink href="/designer/products">Studio</NavLink>
                  {/* <NavLink href="/designer/promotions">Promotions</NavLink> */}
                </>
              )}
              {isAdmin && <NavLink href="/admin">Admin</NavLink>}
            </>
          ) : (
            <>
              <NavLink href="/products">Browse</NavLink>
              <NavLink href="/resale">Pre-loved</NavLink>
            </>
          )}
        </div>

        {/* Desktop right actions */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/cart"
                aria-label="Shopping cart"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ShoppingCart size={20} weight="regular" aria-hidden="true" />
              </Link>
              <div
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none">
                      <UserAvatar name={displayName ?? "U"} />
                      {displayName && (
                        <span className="max-w-[100px] truncate">
                          {displayName}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className="w-56"
                  >
                    {/* Section 1: User info */}
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium leading-none">
                          {displayName ?? "User"}
                        </p>
                        {user?.email && (
                          <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {/* Section 2: General navigation */}
                    <DropdownMenuGroup>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard">
                          <UserIcon size={16} weight="regular" />
                          Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/orders">
                          <Package size={16} weight="regular" />
                          Orders
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/looks">
                          <Heart size={16} weight="regular" />
                          Saved Looks
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/profile/preferences">
                          <GearSix size={16} weight="regular" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>

                    {/* Section 3: Designer-only */}
                    {isDesigner && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem asChild>
                            <Link href="/designer/products">
                              <Storefront size={16} weight="regular" />
                              Studio
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/designer/promotions">
                              <Megaphone size={16} weight="regular" />
                              Promotions
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </>
                    )}

                    {/* Section 3b: Admin-only */}
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem asChild>
                            <Link href="/admin">
                              <ShieldCheck size={16} weight="regular" />
                              Admin
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </>
                    )}

                    {/* Section 4: Sign out */}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="text-destructive focus:text-destructive"
                    >
                      <SignOut size={16} weight="regular" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-hover transition-colors"
            >
              Sign In
            </Link>
          )}
          <ThemeToggle />
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="flex md:hidden items-center gap-3">
          <ThemeToggle />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Toggle navigation menu"
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <List size={22} weight="bold" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 pt-10">
              <div id="mobile-nav" className="flex flex-col gap-6 px-2">
                {user ? (
                  <>
                    {displayName && (
                      <div className="flex items-center gap-3 pb-4 border-b border-border/60">
                        <UserAvatar name={displayName} />
                        <span className="text-sm font-medium text-foreground">
                          {displayName}
                        </span>
                      </div>
                    )}
                    <NavLink
                      href="/community"
                      onClick={() => setMobileOpen(false)}
                    >
                      Community
                    </NavLink>
                    <NavLink
                      href="/style-lab"
                      onClick={() => setMobileOpen(false)}
                    >
                      Style Lab
                    </NavLink>
                    {isDesigner && (
                      <>
                        <NavLink
                          href="/designer/products"
                          onClick={() => setMobileOpen(false)}
                        >
                          Studio
                        </NavLink>
                        <NavLink
                          href="/designer/promotions"
                          onClick={() => setMobileOpen(false)}
                        >
                          Promotions
                        </NavLink>
                      </>
                    )}
                    {isAdmin && (
                      <NavLink
                        href="/admin"
                        onClick={() => setMobileOpen(false)}
                      >
                        Admin
                      </NavLink>
                    )}
                    <NavLink
                      href="/products"
                      onClick={() => setMobileOpen(false)}
                    >
                      Products
                    </NavLink>
                    <NavLink
                      href="/resale"
                      onClick={() => setMobileOpen(false)}
                    >
                      Pre-loved
                    </NavLink>
                    <NavLink
                      href="/cart"
                      onClick={() => setMobileOpen(false)}
                    >
                      Cart
                    </NavLink>
                    <NavLink
                      href="/orders"
                      onClick={() => setMobileOpen(false)}
                    >
                      Orders
                    </NavLink>
                    <NavLink
                      href="/dashboard"
                      onClick={() => setMobileOpen(false)}
                    >
                      Dashboard
                    </NavLink>
                  </>
                ) : (
                  <>
                    <NavLink
                      href="/products"
                      onClick={() => setMobileOpen(false)}
                    >
                      Browse
                    </NavLink>
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-full bg-brand px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-brand-hover transition-colors"
                    >
                      Sign In
                    </Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
