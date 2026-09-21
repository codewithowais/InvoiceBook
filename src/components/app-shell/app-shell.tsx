"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  LayoutDashboard,
  Menu,
  Package,
  Repeat,
  ScrollText,
  Settings,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export type ShellUser = {
  name: string;
  email: string;
  role: "admin" | "staff";
};

export type ShellBusiness = {
  name: string;
  logoUrl?: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/products", label: "Products", icon: Package },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/team", label: "Team", icon: UserCog, adminOnly: true },
  { href: "/activity", label: "Activity", icon: ScrollText, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  pathname,
  role,
  collapsed = false,
  onNavigate,
}: {
  pathname: string;
  role: "admin" | "staff";
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {NAV.filter((item) => !item.adminOnly || role === "admin").map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            className={cn(
              "group relative flex items-center rounded-lg text-sm font-medium transition-colors",
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
              active
                ? "bg-primary-soft text-primary-soft-fg"
                : "text-muted hover:bg-surface-3 hover:text-foreground",
            )}
          >
            {!collapsed ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
            ) : null}
            <Icon
              className={cn(
                "size-[1.15rem] shrink-0 transition-colors",
                active ? "text-primary" : "text-muted-2 group-hover:text-foreground",
              )}
              aria-hidden
            />
            {collapsed ? (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-[calc(100%+0.6rem)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100"
              >
                {label}
              </span>
            ) : (
              label
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  user,
  business,
  children,
}: {
  user: ShellUser;
  business: ShellBusiness;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Restore the collapsed preference (per-viewer convenience, best-effort).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem("ib-sidebar-collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("ib-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Close the mobile drawer whenever the active route changes. This is the
  // documented "adjust state during render" pattern — no effect, no cascade.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-dvh bg-grain">
      {/* Sidebar — desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-surface/80 backdrop-blur transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <div className={cn("flex h-16 items-center", collapsed ? "justify-center px-0" : "px-5")}>
          <Link href="/dashboard" aria-label="InvoiceBook home">
            <Logo withWordmark={!collapsed} />
          </Link>
        </div>
        <div
          className={cn(
            "flex-1 py-4",
            // Collapsed: overflow visible so hover tooltips escape the rail
            // (few items, no scroll needed). Expanded: normal scroll area.
            collapsed ? "overflow-visible px-2" : "overflow-y-auto px-3",
          )}
        >
          <NavLinks pathname={pathname} role={user.role} collapsed={collapsed} />
        </div>
        <div className={cn("border-t border-border", collapsed ? "p-2" : "p-4")}>
          {collapsed ? null : (
            <div className="mb-2 px-1">
              <p className="truncate text-xs font-medium text-muted-2">
                Signed in to
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {business.name}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center rounded-lg text-sm font-medium text-muted transition-colors hover:bg-surface-3 hover:text-foreground",
              collapsed ? "w-full justify-center p-2" : "w-full gap-2 px-3 py-2",
            )}
          >
            {collapsed ? (
              <ChevronsRight className="size-[1.15rem] shrink-0" aria-hidden />
            ) : (
              <>
                <ChevronsLeft className="size-[1.15rem] shrink-0" aria-hidden />
                Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            aria-hidden
            onClick={() => setMobileOpen(false)}
            style={{ animation: "overlay-in 0.2s ease both" }}
            className="absolute inset-0 bg-[color-mix(in_oklab,var(--foreground)_45%,transparent)] backdrop-blur-[2px]"
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[82%] flex-col border-r border-border bg-surface shadow-lg"
            style={{ animation: "dialog-in 0.24s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <div className="flex h-16 items-center justify-between px-4">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-muted-2 hover:bg-surface-3 hover:text-foreground"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavLinks
                pathname={pathname}
                role={user.role}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
            <div className="border-t border-border p-4">
              <p className="truncate text-xs font-medium text-muted-2">
                Signed in to
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {business.name}
              </p>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-muted hover:bg-surface-3 hover:text-foreground lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <Logo withWordmark={false} />
          </div>

          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-medium text-muted">
              {business.name}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <div className="h-6 w-px bg-border" aria-hidden />
            <UserMenu name={user.name} email={user.email} role={user.role} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
