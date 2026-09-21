"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { computeItemLine } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCurrencySymbol } from "@/lib/currency";
import { newItem, toComputeItem, type EditorItem } from "./editor-utils";

export function LineItemsEditor({
  items,
  currency,
  onChange,
  error,
  extraAction,
}: {
  items: EditorItem[];
  currency: string;
  onChange: (items: EditorItem[]) => void;
  error?: string;
  /** Rendered next to the "Add line item" button (e.g. an "Add from products" control). */
  extraAction?: React.ReactNode;
}) {
  const symbol = getCurrencySymbol(currency);

  function update(key: string, patch: Partial<EditorItem>) {
    onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function remove(key: string) {
    onChange(items.filter((it) => it.key !== key));
  }
  function add() {
    onChange([...items, newItem()]);
  }

  return (
    <div className="space-y-3">
      {/*
        On small screens each row is a self-contained stacked card. From md up
        the rows become a table-like grid; that grid has a fixed minimum width,
        so we let it scroll horizontally inside its own card rather than force
        the page (and the summary sidebar) to overflow.
      */}
      <div className="md:-mx-1 md:overflow-x-auto md:px-1">
        <div className="space-y-3 md:min-w-[42rem] md:space-y-2">
          {/* Column headers (desktop) */}
          <div className="hidden grid-cols-[1fr_5rem_8rem_5.5rem_7rem_2.25rem] gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-muted-2 md:grid">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Tax %</span>
            <span className="text-right">Amount</span>
            <span className="sr-only">Remove</span>
          </div>

          {items.map((item, index) => {
          const line = computeItemLine(toComputeItem(item));
          return (
            <div
              key={item.key}
              className="rounded-xl border border-border bg-surface-2 p-3 md:grid md:grid-cols-[1fr_5rem_8rem_5.5rem_7rem_2.25rem] md:items-center md:gap-3 md:rounded-lg md:border-transparent md:bg-transparent md:p-1"
            >
              <div className="flex items-start gap-2">
                <GripVertical
                  className="mt-2.5 hidden size-4 shrink-0 text-muted-2/50 md:block"
                  aria-hidden
                />
                <Input
                  aria-label={`Line ${index + 1} description`}
                  value={item.description}
                  onChange={(e) => update(item.key, { description: e.target.value })}
                  placeholder="Design services — March"
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 md:mt-0 md:contents">
                <label className="md:contents">
                  <span className="mb-1 block text-xs text-muted-2 md:hidden">
                    Qty
                  </span>
                  <Input
                    aria-label={`Line ${index + 1} quantity`}
                    type="text"
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) => update(item.key, { quantity: e.target.value })}
                    className="text-right tabular"
                    placeholder="1"
                  />
                </label>
                <label className="md:contents">
                  <span className="mb-1 block text-xs text-muted-2 md:hidden">
                    Unit price
                  </span>
                  <Input
                    aria-label={`Line ${index + 1} unit price`}
                    type="text"
                    inputMode="decimal"
                    prefix={symbol}
                    value={item.unitPrice}
                    onChange={(e) => update(item.key, { unitPrice: e.target.value })}
                    className="text-right tabular"
                    placeholder="0.00"
                  />
                </label>
                <label className="md:contents">
                  <span className="mb-1 block text-xs text-muted-2 md:hidden">
                    Tax %
                  </span>
                  <Input
                    aria-label={`Line ${index + 1} tax percent`}
                    type="text"
                    inputMode="decimal"
                    value={item.taxRatePct}
                    onChange={(e) => update(item.key, { taxRatePct: e.target.value })}
                    className="text-right tabular"
                    placeholder="0"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 md:mt-0 md:block md:border-0 md:pt-0 md:text-right">
                <span className="text-xs text-muted-2 md:hidden">Amount</span>
                <span className="text-sm font-semibold text-foreground tabular">
                  {formatMoney(line.lineTotal, currency)}
                </span>
              </div>

              <div className="mt-2 md:mt-0 md:text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(item.key)}
                  disabled={items.length === 1}
                  aria-label={`Remove line ${index + 1}`}
                  className="size-8 text-muted-2 hover:text-danger disabled:opacity-40"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" aria-hidden />
          Add line item
        </Button>
        {extraAction}
      </div>
    </div>
  );
}
