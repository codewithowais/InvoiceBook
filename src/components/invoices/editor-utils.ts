/** Shared helpers for the invoice & recurring-plan editors (frontend-owned). */
import { qtyToStored, toMinor, qtyFromStored, fromMinor } from "@/lib/money";
import type { ComputeItem } from "@/lib/money";

/** A line-item row as edited in the UI (user-typed decimal strings). */
export type EditorItem = {
  key: string;
  description: string;
  quantity: string; // decimal string, e.g. "2"
  unitPrice: string; // decimal string, e.g. "150.00"
  taxRatePct: string; // percent string, e.g. "17.5"
};

let counter = 0;
export function newItem(partial?: Partial<EditorItem>): EditorItem {
  counter += 1;
  return {
    key: `row-${Date.now()}-${counter}`,
    description: "",
    quantity: "1",
    unitPrice: "",
    taxRatePct: "",
    ...partial,
  };
}

/** Build an editor row from stored (API) values. */
export function itemFromStored(stored: {
  description: string;
  quantity: number; // x1000
  unitPrice: number; // minor
  taxRateBps: number;
}): EditorItem {
  return newItem({
    description: stored.description,
    quantity: String(qtyFromStored(stored.quantity)),
    unitPrice: stored.unitPrice ? String(fromMinor(stored.unitPrice)) : "",
    taxRatePct: stored.taxRateBps ? String(stored.taxRateBps / 100) : "",
  });
}

/** Convert an editor row to integer compute inputs. */
export function toComputeItem(item: EditorItem): ComputeItem {
  return {
    quantity: qtyToStored(item.quantity || "0"),
    unitPrice: toMinor(item.unitPrice || "0"),
    taxRateBps: Math.round(parseFloat(item.taxRatePct || "0") * 100) || 0,
  };
}

/** Convert editor rows to the API line-item payload. */
export function toApiItems(items: EditorItem[]) {
  return items.map((it) => {
    const c = toComputeItem(it);
    return {
      description: it.description.trim(),
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      taxRateBps: c.taxRateBps,
    };
  });
}

/** Percent basis-points from a user string, e.g. "10" -> 1000 bps. */
export function pctToBps(pct: string): number {
  return Math.round((parseFloat(pct || "0") || 0) * 100);
}
