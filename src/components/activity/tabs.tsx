"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export type TabDef = {
  value: string;
  label: string;
  /** Optional trailing count badge. */
  count?: number;
};

/**
 * A minimal, accessible tab bar (WAI-ARIA tabs pattern): roving focus with
 * Left/Right/Home/End arrow keys, `role="tab"` + `aria-selected`, and
 * `aria-controls` wiring to caller-rendered panels. The parent owns the active
 * value and renders the matching panel with `<TabPanel>`.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  idBase,
  className,
  "aria-label": ariaLabel,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (value: string) => void;
  /** Stable base used to derive tab/panel ids (shared with TabPanel). */
  idBase: string;
  className?: string;
  "aria-label": string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusTab(v: string) {
    onChange(v);
    // Move DOM focus to follow the selection (roving tabindex).
    requestAnimationFrame(() => refs.current[v]?.focus());
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const i = tabs.findIndex((t) => t.value === value);
    if (i < 0) return;
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    focusTab(tabs[next].value);
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface-2 p-1",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[t.value] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.value}`}
            aria-selected={active}
            aria-controls={`${idBase}-panel-${t.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted hover:text-foreground",
            )}
          >
            {t.label}
            {typeof t.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                  active
                    ? "bg-primary-soft text-primary-soft-fg"
                    : "bg-surface-3 text-muted-2",
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Panel wrapper matching a `Tabs` value; hidden unless active. */
export function TabPanel({
  idBase,
  value,
  active,
  children,
}: {
  idBase: string;
  value: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      hidden={!active}
      tabIndex={0}
      className="focus:outline-none"
    >
      {active ? children : null}
    </div>
  );
}
