"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "invoicebook-theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export function ThemeToggle() {
  // Default to "system" so the server render and first client render match;
  // the persisted choice is read on mount below.
  const [theme, setTheme] = useState<Theme>("system");

  // Reflect the persisted theme (external system) into state once on mount.
  useEffect(() => {
    let saved: Theme | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    } catch {
      /* ignore */
    }
    if (saved === "light" || saved === "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(saved);
    }
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const options: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "Light theme" },
    { value: "system", icon: Monitor, label: "System theme" },
    { value: "dark", icon: Moon, label: "Dark theme" },
  ];

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5"
    >
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-label={label}
            aria-pressed={active}
            title={label}
            className={cn(
              "grid size-7 place-items-center rounded-md transition-colors",
              active
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted-2 hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
