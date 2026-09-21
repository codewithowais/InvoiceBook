"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronsUpDown, LogOut, Settings, UserRound } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: "admin" | "staff";
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({
      fetchOptions: {
        onSuccess: () => router.push("/login"),
      },
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-transparent p-1 pr-2 transition-colors hover:border-border hover:bg-surface-2"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-fg ring-1 ring-inset ring-primary/15">
          {initials(name)}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[9rem] truncate text-[0.8125rem] font-medium leading-tight text-foreground">
            {name}
          </span>
          <span className="block text-[0.6875rem] capitalize leading-tight text-muted-2">
            {role}
          </span>
        </span>
        <ChevronsUpDown className="hidden size-4 text-muted-2 sm:block" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
          style={{ animation: "fade-in 0.16s ease both" }}
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-foreground">
              {name}
            </p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <div className="p-1.5">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-surface-3"
            >
              <Settings className="size-4 text-muted-2" aria-hidden />
              Business settings
            </Link>
            <div
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted"
            >
              <UserRound className="size-4 text-muted-2" aria-hidden />
              <span className="capitalize">{role} account</span>
            </div>
          </div>
          <div className="border-t border-border p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-60",
              )}
            >
              <LogOut className="size-4" aria-hidden />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
