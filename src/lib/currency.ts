/** Currency helpers for the UI (frontend-owned). */
import { currencyCodes } from "@/lib/validation";

export const CURRENCIES = currencyCodes;
export type CurrencyCode = (typeof currencyCodes)[number];

const NAMES: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  PKR: "Pakistani Rupee",
  AED: "UAE Dirham",
  INR: "Indian Rupee",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
};

export function currencyLabel(code: string): string {
  return NAMES[code] ? `${code} — ${NAMES[code]}` : code;
}

/** Best-effort currency symbol via Intl, falling back to the code. */
export function getCurrencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}
