"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Search,
  Heart,
  Menu,
  User as UserIcon,
  Package,
  Settings,
  Store,
  Megaphone,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
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

interface SiteHeaderProps {
  variant?: "app" | "landing";
}

interface NavItem {
  href: string;
  label: string;
}

const APP_NAV: NavItem[] = [
  { href: "/products", label: "SHOP" },
  { href: "/chat", label: "AI STYLIST" },
  { href: "/try-on", label: "VIRTUAL FITTING" },
  { href: "/community", label: "COMMUNITY" },
];

const LANDING_NAV: NavItem[] = [
  { href: "/products", label: "SHOP" },
  { href: "/community", label: "DISCOVER" },
  { href: "/try-on", label: "VIRTUAL FIT" },
];

function NavLink({
  href,
  label,
  onClick,
}: NavItem & { onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "font-body font-medium text-[12px] uppercase tracking-[0.12px] transition-colors",
        isActive ? "text-brand" : "text-foreground hover:text-brand"
      )}
    >
      {label}
    </Link>
  );
}

function avatarInitial(name: string | null | undefined): string {
  return (name?.trim()?.[0] ?? "U").toUpperCase();
}

export function SiteHeader({ variant = "app" }: SiteHeaderProps) {
  const { user, logout } = useAuth();
  const { surface } = useProfileSurface();
  const { totalCount } = useCart();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = surface.displayName ?? user?.name ?? null;
  const isDesigner = user?.role === "DESIGNER";
  const isAdmin = user?.role === "ADMIN";
  const navItems = variant === "landing" ? LANDING_NAV : APP_NAV;

  const handleMouseEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setProfileOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
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
    <header className="sticky top-0 z-50 h-[82px] w-full border-b border-border bg-background">
      <nav className="relative mx-auto flex h-full max-w-7xl items-center justify-between px-6 lg:px-12">
        {/* Left: wordmark (app) / nav (landing) */}
        <div className="flex items-center gap-8">
          {variant === "app" && (
            <Link
              href="/"
              className="font-display text-[29px] font-semibold text-foreground"
            >
              {BRAND.name}
            </Link>
          )}
          {variant === "landing" && (
            <div className="hidden items-center gap-8 md:flex">
              {navItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          )}
        </div>

        {/* Center: nav (app only) */}
        {variant === "app" && (
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
            {navItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        )}

        {/* Right cluster */}
        <div className="flex items-center gap-5">
          {variant === "app" && (
            <>
              <Link
                href="/products"
                aria-label="Search"
                className="hidden text-foreground transition-colors hover:text-brand md:block"
              >
                <Search width={20} height={20} aria-hidden="true" />
              </Link>
              <Link
                href="/looks"
                aria-label="Saved looks"
                className="hidden text-foreground transition-colors hover:text-brand md:block"
              >
                <Heart width={20} height={20} aria-hidden="true" />
              </Link>
            </>
          )}

          <Link
            href="/cart"
            className="hidden font-body text-[11px] uppercase tracking-[0.12px] text-foreground transition-colors hover:text-brand md:block"
          >
            BAG ({totalCount})
          </Link>

          {user ? (
            <div
              className="hidden md:block"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Account menu"
                    className="flex size-[34px] items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-background outline-none"
                  >
                    {avatarInitial(displayName)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  className="w-56"
                >
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
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">
                        <UserIcon width={16} height={16} />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/orders">
                        <Package width={16} height={16} />
                        Orders
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/looks">
                        <Heart width={16} height={16} />
                        Saved Looks
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile/preferences">
                        <Settings width={16} height={16} />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  {isDesigner && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem asChild>
                          <Link href="/designer/products">
                            <Store width={16} height={16} />
                            Studio
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/designer/promotions">
                            <Megaphone width={16} height={16} />
                            Promotions
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem asChild>
                          <Link href="/admin">
                            <ShieldCheck width={16} height={16} />
                            Admin
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut width={16} height={16} />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden font-body text-[11px] uppercase tracking-[0.12px] text-foreground transition-colors hover:text-brand md:block"
            >
              ACCOUNT
            </Link>
          )}

          {/* Mobile hamburger */}
          <div className="flex items-center md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  aria-label="Toggle navigation menu"
                  aria-expanded={mobileOpen}
                  aria-controls="site-mobile-nav"
                  className="text-foreground transition-colors hover:text-brand"
                >
                  <Menu width={22} height={22} aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 pt-10">
                <div
                  id="site-mobile-nav"
                  className="flex flex-col gap-6 px-2"
                >
                  {navItems.map((item) => (
                    <NavLink
                      key={item.href}
                      {...item}
                      onClick={() => setMobileOpen(false)}
                    />
                  ))}
                  <Link
                    href="/cart"
                    onClick={() => setMobileOpen(false)}
                    className="font-body text-[12px] uppercase tracking-[0.12px] text-foreground hover:text-brand"
                  >
                    BAG ({totalCount})
                  </Link>
                  {user ? (
                    <>
                      <Link
                        href="/dashboard"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 font-body text-[12px] uppercase tracking-[0.12px] text-foreground hover:text-brand"
                      >
                        <span className="flex size-[34px] items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-background">
                          {avatarInitial(displayName)}
                        </span>
                        {displayName ?? "Profile"}
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileOpen(false);
                          handleSignOut();
                        }}
                        className="text-left font-body text-[12px] uppercase tracking-[0.12px] text-destructive"
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="font-body text-[12px] uppercase tracking-[0.12px] text-foreground hover:text-brand"
                    >
                      ACCOUNT
                    </Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </header>
  );
}
