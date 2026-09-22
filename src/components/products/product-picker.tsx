"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PackagePlus, Plus } from "lucide-react";
import { apiGet, asArray } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { LoadingBlock } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";

/** The shape appended to a line-item editor — stored units (qty ×1000, minor money, bps). */
export type PickedProduct = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRateBps: number;
};

export function ProductPicker({
  currency,
  onPick,
  size = "sm",
}: {
  currency: string;
  onPick: (item: PickedProduct) => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size={size} onClick={() => setOpen(true)}>
        <PackagePlus className="size-4" aria-hidden />
        Add from products
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add from products"
        description="Pick a saved product to drop in a line item. It stays fully editable afterwards."
        size="md"
      >
        <PickerBody
          currency={currency}
          onPick={(item) => {
            onPick(item);
            setOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}

function PickerBody({
  currency,
  onPick,
}: {
  currency: string;
  onPick: (item: PickedProduct) => void;
}) {
  const [search, setSearch] = useState("");

  const { data, loading, error, refetch } = useAsync<Product[]>(async () => {
    const res = await apiGet<Product[] | { products: Product[] }>(
      "/api/products?activeOnly=1",
    );
    return asArray(res);
  }, [], "products:active");

  const products = data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  if (loading) {
    return <LoadingBlock label="Loading products…" />;
  }
  if (error) {
    return <ErrorState description={error} onRetry={refetch} />;
  }
  if (products.length === 0) {
    return (
      <EmptyState
        icon={PackagePlus}
        title="No products yet"
        description="Save a product first, then add it to invoices in a click."
        action={
          <Link
            href="/products"
            className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
          >
            Go to Products
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search products…"
        aria-label="Search products"
      />
      {filtered.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted">
          No products match &ldquo;{search}&rdquo;.
        </p>
      ) : (
        <ul className="max-h-[46vh] space-y-1.5 overflow-y-auto">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    description: p.name,
                    quantity: 1000,
                    unitPrice: p.unitPrice,
                    taxRateBps: p.taxRateBps,
                  })
                }
                className="group flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-surface-2 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.name}
                  </p>
                  {p.description ? (
                    <p className="truncate text-xs text-muted-2">{p.description}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-foreground tabular">
                    {formatMoney(p.unitPrice, currency)}
                    <span className="font-normal text-muted-2">/mo</span>
                  </p>
                  {p.taxRateBps ? (
                    <p className="text-xs text-muted-2 tabular">
                      +{p.taxRateBps / 100}% tax
                    </p>
                  ) : null}
                </div>
                <Plus
                  className="size-4 shrink-0 text-muted-2 transition-colors group-hover:text-primary"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
