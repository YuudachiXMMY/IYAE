"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  List,
  ShoppingCart,
  User as UserIcon,
  Package,
  Heart,
  GearSix,
  Storefront,
  Megaphone,
  SignOut,
} from "@phosphor-icons/react";
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
import { useAuth } from "@/lib/auth-context";
import { useProfileSurface } from "@/lib/profile-surface";
import { ProfileSettingsDialog } from "@/components/profile/ProfileSettingsDialog";
import { BRAND } from "@/lib/brand";

interface NavAnchorProps {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  mobile?: boolean;
}

function NavAnchor({ href, children, onClick, mobile }: NavAnchorProps) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (onClick) onClick();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (mobile) {
    return (
      <a
        href={href}
        onClick={handleClick}
        className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        {children}
      </a>
    );
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className="text-sm font-medium tracking-wide text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-px after:bg-foreground hover:after:w-full after:transition-all after:duration-300"
    >
      {children}
    </a>
  );
}

const NAV_LINKS = [
  { href: "#ai-stylist", label: "AI Stylist" },
  { href: "#try-on", label: "Try-On" },
  { href: "#designers", label: "Designers" },
  { href: "#how-it-works", label: "How It Works" },
];

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

export function LandingNav() {
  const { user, logout, refreshUser } = useAuth();
  const { surface, updateSurface } = useProfileSurface(
    user ? String(user.id) : undefined
  );
  const displayName = surface.displayName ?? user?.name ?? null;
  const isDesigner = user?.role === "DESIGNER";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [logout]);

  useEffect(() => {
    const sentinel = document.createElement("div");
    sentinel.style.cssText =
      "position:absolute;top:50px;left:0;width:1px;height:1px;pointer-events:none";
    document.body.appendChild(sentinel);

    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 1 }
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 bg-card/70 backdrop-blur-xl border-b border-border/30${scrolled ? " shadow-sm" : ""}`}
    >
      <nav className="max-w-7xl mx-auto px-6 lg:px-8 flex justify-between items-center h-16">
        <Link
          href="/"
          className="font-display text-2xl font-bold tracking-tight text-foreground"
        >
          {BRAND.name}
        </Link>

        <div className="hidden md:flex items-center space-x-10">
          {NAV_LINKS.map(({ href, label }) => (
            <NavAnchor key={href} href={href}>
              {label}
            </NavAnchor>
          ))}
        </div>

        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <Link
                href="/cart"
                aria-label="Shopping cart"
                className="hidden md:block text-muted-foreground hover:text-foreground transition-colors"
              >
                <ShoppingCart size={20} weight="regular" aria-hidden="true" />
              </Link>
              <div
                className="hidden md:block"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none">
                      <UserAvatar name={displayName ?? "U"} />
                      {displayName && (
                        <span className="max-w-[120px] truncate">{displayName}</span>
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
                      <DropdownMenuItem
                        onSelect={() => {
                          setProfileOpen(false);
                          setSettingsOpen(true);
                        }}
                      >
                        <GearSix size={16} weight="regular" />
                        Settings
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
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
            <>
              <Link
                href="/login"
                className="hidden md:block text-sm font-medium text-muted-foreground hover:text-landing-accent transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="hidden md:block px-6 py-2.5 bg-foreground text-background text-sm font-medium rounded-full hover:bg-landing-accent transition-all duration-300 hover:shadow-lg active:scale-[0.98]"
              >
                Get Started
              </Link>
            </>
          )}

          <div className="flex md:hidden items-center">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  aria-label="Open menu"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <List size={24} weight="bold" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 pt-10">
                <div className="flex flex-col gap-2 px-2">
                  {NAV_LINKS.map(({ href, label }) => (
                    <NavAnchor
                      key={href}
                      href={href}
                      mobile
                      onClick={() => setMobileOpen(false)}
                    >
                      {label}
                    </NavAnchor>
                  ))}
                  <div className="border-t border-border/60 pt-4 mt-2 flex flex-col gap-3">
                    {user ? (
                      <>
                        <Link
                          href="/cart"
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 text-base font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                        >
                          <ShoppingCart size={18} weight="regular" aria-hidden="true" />
                          Cart
                        </Link>
                        <Link
                          href="/dashboard"
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3 text-base font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                        >
                          <UserAvatar name={displayName ?? "U"} />
                          {displayName ?? "Profile"}
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/login"
                          onClick={() => setMobileOpen(false)}
                          className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                        >
                          Log In
                        </Link>
                        <Link
                          href="/register"
                          onClick={() => setMobileOpen(false)}
                          className="px-6 py-2.5 bg-foreground text-background text-sm font-medium rounded-full text-center hover:bg-landing-accent transition-all duration-300"
                        >
                          Get Started
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {user && (
        <ProfileSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          user={user as Parameters<typeof ProfileSettingsDialog>[0]["user"]}
          surface={surface}
          onUpdateSurface={updateSurface}
          onUserRefresh={refreshUser}
        />
      )}
    </header>
  );
}
