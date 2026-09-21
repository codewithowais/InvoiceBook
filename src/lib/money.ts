/**
 * Money is stored as integer minor units (e.g. cents). Never floats.
 * Quantities are stored x1000 to allow up to 3 decimal places.
 */

export const QTY_SCALE = 1000;

/** Format minor units + currency to a localized string, e.g. 12345 -> "$123.45". */
export function formatMoney(minor: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

/** Parse a user-typed amount like "123.45" into minor units (12345). */
export function toMinor(input: string | number): number {
  const n = typeof input === "number" ? input : parseFloat(input);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Minor units -> decimal number for form fields (12345 -> 123.45). */
export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

/** Quantity helpers (stored x1000). */
export function qtyToStored(input: string | number): number {
  const n = typeof input === "number" ? input : parseFloat(input);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * QTY_SCALE);
}

export function qtyFromStored(stored: number): number {
  return stored / QTY_SCALE;
}

export function formatQty(stored: number): string {
  const n = stored / QTY_SCALE;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * Compute all totals for a set of line items and an optional discount.
 * All inputs/outputs are integers (minor units, qty x1000, tax in bps).
 */
export type ComputeItem = {
  quantity: number; // x1000
  unitPrice: number; // minor
  taxRateBps: number; // basis points
};

export function computeItemLine(item: ComputeItem) {
  // lineSubtotal = unitPrice * quantity / QTY_SCALE
  const lineSubtotal = Math.round((item.unitPrice * item.quantity) / QTY_SCALE);
  const lineTax = Math.round((lineSubtotal * item.taxRateBps) / 10000);
  return {
    lineSubtotal,
    lineTax,
    lineTotal: lineSubtotal + lineTax,
  };
}

export type ComputeTotalsInput = {
  items: ComputeItem[];
  discountType: "none" | "flat" | "percent";
  discountValue: number; // flat: minor units; percent: basis points
};

export function computeTotals(input: ComputeTotalsInput) {
  let subtotal = 0;
  let taxTotal = 0;
  const lines = input.items.map((item) => {
    const line = computeItemLine(item);
    subtotal += line.lineSubtotal;
    taxTotal += line.lineTax;
    return line;
  });

  let discount = 0;
  if (input.discountType === "flat") {
    discount = Math.min(input.discountValue, subtotal);
  } else if (input.discountType === "percent") {
    discount = Math.round((subtotal * input.discountValue) / 10000);
  }

  // Discount applies to subtotal; tax is on pre-discount lines (simple model).
  const total = subtotal - discount + taxTotal;
  return { subtotal, taxTotal, discount, total: Math.max(0, total), lines };
}
