"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FileText } from "lucide-react";
import { apiGet, asArray } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import { useDebounced } from "@/lib/use-debounced";
import type { InvoiceListItem } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { toDisplayStatus, INVOICE_STATUS_FILTERS } from "@/lib/invoice-ui";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export default function InvoicesPage() {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("dueDate");
  const debounced = useDebounced(search, 300);

  const { data, loading, error, refetch } = useAsync<InvoiceListItem[]>(
    async () => {
      const qs = new URLSearchParams();
      if (status !== "all") qs.set("status", status);
      if (debounced) qs.set("search", debounced);
      if (sort) qs.set("sort", sort);
      const q = qs.toString();
      const res = await apiGet<InvoiceListItem[] | { items: InvoiceListItem[] }>(
        `/api/invoices${q ? `?${q}` : ""}`,
      );
      return asArray(res);
    },
    [status, debounced, sort],
    `invoices:${status}:${debounced}:${sort}`,
  );

  const invoices = data ?? [];
  const filtering = status !== "all" || debounced.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        description="Track every invoice — what's owed, paid, and overdue."
        actions={
          <ButtonLink href="/invoices/new">
            <FilePlus2 className="size-4" aria-hidden />
            New invoice
          </ButtonLink>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Filter by status"
          className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-2 p-1"
        >
          {INVOICE_STATUS_FILTERS.map((f) => {
            const active = status === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatus(f.value)}
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

        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search number or customer…"
            aria-label="Search invoices"
            className="min-w-0 flex-1 sm:w-64 sm:flex-none"
          />
          <label className="flex shrink-0 items-center gap-1.5">
            <span className="hidden text-sm text-muted sm:inline">Sort</span>
            <Select
              aria-label="Sort invoices"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-10 w-36"
            >
              <option value="dueDate">Due date</option>
              <option value="total">Amount</option>
            </Select>
          </label>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={7} cols={6} />
        ) : error ? (
          <ErrorState description={error} onRetry={refetch} />
        ) : invoices.length === 0 ? (
          filtering ? (
            <EmptyState
              icon={FileText}
              title="No invoices match"
              description="Try a different status or search term."
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="Create your first invoice to start billing customers."
              action={
                <ButtonLink href="/invoices/new">
                  <FilePlus2 className="size-4" aria-hidden />
                  New invoice
                </ButtonLink>
              }
            />
          )
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Invoice</TH>
                <TH className="hidden md:table-cell">Customer</TH>
                <TH>Status</TH>
                <TH className="hidden text-right sm:table-cell">Due</TH>
                <TH className="text-right">Total</TH>
                <TH className="hidden text-right lg:table-cell">Outstanding</TH>
              </TR>
            </THead>
            <TBody>
              {invoices.map((inv) => {
                const display = toDisplayStatus(inv.status, inv.dueDate);
                return (
                  <TR
                    key={inv.id}
                    interactive
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                  >
                    <TD>
                      <p className="font-mono text-[0.8125rem] font-medium text-foreground">
                        {inv.number ?? "Draft"}
                      </p>
                      <p className="text-xs text-muted-2 md:hidden">
                        {inv.customerName}
                      </p>
                    </TD>
                    <TD className="hidden text-muted md:table-cell">
                      {inv.customerName}
                    </TD>
                    <TD>
                      <StatusBadge status={display} />
                    </TD>
                    <TD className="hidden text-right text-muted sm:table-cell">
                      {formatDate(inv.dueDate)}
                    </TD>
                    <TD className="text-right font-semibold tabular">
                      {formatMoney(inv.total, inv.currency)}
                    </TD>
                    <TD className="hidden text-right tabular lg:table-cell">
                      {inv.outstanding > 0 ? (
                        <span className="text-foreground">
                          {formatMoney(inv.outstanding, inv.currency)}
                        </span>
                      ) : (
                        <span className="text-muted-2">—</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
