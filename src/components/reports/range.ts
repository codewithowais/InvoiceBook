import type { RangePreset } from "./types";

/** Local-time YYYY-MM-DD (matches <input type="date"> and the API contract). */
export function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Resolve a non-custom preset to a concrete { from, to } range. */
export function presetRange(preset: Exclude<RangePreset, "custom">): {
  from: string;
  to: string;
} {
  const now = new Date();
  const to = isoLocal(now);
  let from: Date;
  switch (preset) {
    case "this_month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_3_months":
      // Current month plus the previous two (three month buckets).
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case "this_year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "last_12_months":
    default:
      from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      break;
  }
  return { from: isoLocal(from), to };
}

export const PRESET_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "this_year", label: "This year" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
];
