"use client";

import { useMemo, useState } from "react";
import { ArchiveRestore, Package, Pencil, Plus } from "lucide-react";
import { apiGet, apiPatch, asArray, ApiError } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import { useDebounced } from "@/lib/use-debounced";
import { useBusiness } from "@/components/app-shell/business-context";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ProductFormDialog } from "@/components/products/product-form-dialog";

type StatusFilter = "all" | "active" | "archived";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export default function ProductsPage() {
  const { currency } = useBusiness();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 300);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [archiving, setArchiving] = useState<Product | null>(null);

  const { data, loading, error, refetch } = useAsync<Product[]>(async () => {
    const qs = debounced ? `?search=${encodeURIComponent(debounced)}` : "";
    const res = await apiGet<Product[] | { products: Product[] }>(
      `/api/products${qs}`,
    );
    return asArray(res);
  }, [debounced], `products:${debounced}`);

  const all = data ?? [];
  const products = useMemo(() => {
    if (filter === "active") return all.filter((p) => p.isActive);
    if (filter === "archived") return all.filter((p) => !p.isActive);
    return all;
  }, [all, filter]);

  const isSearching = debounced.length > 0;

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setDialogOpen(true);
  }

  async function setActive(product: Product, isActive: boolean) {
    try {
      await apiPatch<Product>(`/api/products/${product.id}`, { isActive });
      toast({
        variant: "success",
        title: isActive ? "Product restored" : "Product archived",
        description: product.name,
      });
      setArchiving(null);
      refetch();
    } catch (err) {
      toast({
        variant: "error",
        title: isActive ? "Couldn't restore product" : "Couldn't archive product",
        description: err instanceof ApiError ? err.message : undefined,
      });
      setArchiving(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Save the plans and services you sell once, then add them to invoices in a click."
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4" aria-hidden />
            New product
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search products…"
            aria-label="Search products"
            className="w-full sm:max-w-sm"
          />
          <div
            role="tablist"
            aria-label="Filter by status"
            className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-2 p-1"
          >
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : error ? (
          <ErrorState description={error} onRetry={refetch} />
        ) : products.length === 0 ? (
          isSearching || filter !== "all" ? (
            <EmptyState
              icon={Package}
              title="No matches"
              description={
                isSearching
                  ? `No products match "${debounced}".`
                  : `You have no ${filter} products.`
              }
            />
          ) : (
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Add your first product to speed up invoicing."
              action={
                <Button onClick={openNew}>
                  <Plus className="size-4" aria-hidden />
                  New product
                </Button>
              }
            />
          )
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Product</TH>
                <TH className="text-right">Monthly price</TH>
                <TH className="hidden text-right sm:table-cell">Tax</TH>
                <TH className="text-center">Status</TH>
                <TH className="w-24 text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {products.map((p) => (
                <TR
                  key={p.id}
                  interactive
                  onClick={() => openEdit(p)}
                  className={cn(!p.isActive && "opacity-70")}
                >
                  <TD>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {p.name}
                      </p>
                      {p.description ? (
                        <p className="truncate text-xs text-muted-2">
                          {p.description}
                        </p>
                      ) : null}
                    </div>
                  </TD>
                  <TD className="text-right font-semibold tabular">
                    {formatMoney(p.unitPrice, currency)}
                    <span className="font-normal text-muted-2">/mo</span>
                  </TD>
                  <TD className="hidden text-right tabular text-muted sm:table-cell">
                    {p.taxRateBps ? `${p.taxRateBps / 100}%` : "—"}
                  </TD>
                  <TD className="text-center">
                    <Badge variant={p.isActive ? "success" : "neutral"}>
                      {p.isActive ? "Active" : "Archived"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${p.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(p);
                        }}
                        className="rounded-md p-1.5 text-muted-2 transition-colors hover:bg-surface-3 hover:text-foreground"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      {p.isActive ? (
                        <button
                          type="button"
                          aria-label={`Archive ${p.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setArchiving(p);
                          }}
                          className="rounded-md p-1.5 text-muted-2 transition-colors hover:bg-surface-3 hover:text-foreground"
                        >
                          <ArchiveRestore className="size-4" aria-hidden />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Restore ${p.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void setActive(p, true);
                          }}
                          className="rounded-md p-1.5 text-primary transition-colors hover:bg-primary-soft"
                        >
                          <ArchiveRestore className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <ProductFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        product={editing}
        currency={currency}
        onSaved={() => refetch()}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        onConfirm={() => {
          if (archiving) return setActive(archiving, false);
        }}
        title="Archive this product?"
        description={
          archiving
            ? `"${archiving.name}" will stop showing in the product picker. Invoices that already use it keep their line items, and you can restore it anytime.`
            : ""
        }
        confirmLabel="Archive product"
        variant="danger"
      />
    </div>
  );
}
