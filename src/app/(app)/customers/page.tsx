"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Users } from "lucide-react";
import { apiGet, asArray } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import { useDebounced } from "@/lib/use-debounced";
import { useBusiness } from "@/components/app-shell/business-context";
import type { Customer, CustomerListItem } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";

export default function CustomersPage() {
  const router = useRouter();
  const { currency } = useBusiness();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 300);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const { data, loading, error, refetch } = useAsync<CustomerListItem[]>(
    async () => {
      const qs = debounced ? `?search=${encodeURIComponent(debounced)}` : "";
      const res = await apiGet<CustomerListItem[] | { items: CustomerListItem[] }>(
        `/api/customers${qs}`,
      );
      return asArray(res);
    },
    [debounced],
    `customers:${debounced}`,
  );

  const customers = data ?? [];
  const isSearching = debounced.length > 0;

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setDialogOpen(true);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Directory"
        title="Customers"
        description="Everyone you bill, with their outstanding balance at a glance."
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4" aria-hidden />
            New customer
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-border p-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or email…"
            aria-label="Search customers"
            className="max-w-sm"
          />
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : error ? (
          <ErrorState description={error} onRetry={refetch} />
        ) : customers.length === 0 ? (
          isSearching ? (
            <EmptyState
              icon={Users}
              title="No matches"
              description={`No customers match "${debounced}".`}
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Add your first customer to start invoicing them."
              action={
                <Button onClick={openNew}>
                  <Plus className="size-4" aria-hidden />
                  New customer
                </Button>
              }
            />
          )
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH className="hidden sm:table-cell">Last invoice</TH>
                <TH className="text-right">Outstanding</TH>
                <TH className="w-10 text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {customers.map((c) => (
                <TR
                  key={c.id}
                  interactive
                  onClick={() => router.push(`/customers/${c.id}`)}
                >
                  <TD>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {c.name}
                      </p>
                      <p className="truncate text-xs text-muted-2">{c.email}</p>
                    </div>
                  </TD>
                  <TD className="hidden text-muted sm:table-cell">
                    {formatDate(c.lastInvoiceDate)}
                  </TD>
                  <TD className="text-right">
                    {c.outstanding > 0 ? (
                      <span className="font-semibold text-foreground tabular">
                        {formatMoney(c.outstanding, currency)}
                      </span>
                    ) : (
                      <span className="text-muted-2 tabular">—</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <button
                      type="button"
                      aria-label={`Edit ${c.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(c);
                      }}
                      className="rounded-md p-1.5 text-muted-2 transition-colors hover:bg-surface-3 hover:text-foreground"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <CustomerFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        customer={editing}
        onSaved={() => refetch()}
      />
    </div>
  );
}
