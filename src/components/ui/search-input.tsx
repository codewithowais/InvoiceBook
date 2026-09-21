"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  "aria-label": ariaLabel = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2"
        aria-hidden
      />
      <input
        type="search"
        role="searchbox"
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-9 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-2 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-2 transition-colors hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
