"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FilePlus2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { apiGet, apiPatch, ApiError } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import { useBusiness } from "@/components/app-shell/business-context";
import type { Customer, CustomerDetail } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { toDisplayStatus } from "@/lib/invoice-ui";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingBlock } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { useToast } from "@/components/ui/toast";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { currency, role } = useBusiness();
  const { toast } = useToast();

  const { data, loading, error, refetch, setData } = useAsync<CustomerDetail>(
    () => apiGet<CustomerDetail>(`/api/customers/${id}`),
    [id],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    try {
      await apiPatch(`/api/customers/${id}/delete`);
      toast({ variant: "success", title: "Customer deleted" });
      router.push("/customers");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Couldn't delete this customer.";
      toast({ variant: "error", title: "Delete failed", description: message });
      setDeleteOpen(false);
    }
  }

  return (
    <div>
      <Link
        href="/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Customers
      </Link>

      {loading ? (
        <Card>
          <LoadingBlock label="Loading customer…" />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState description={error} onRetry={refetch} />
        </Card>
      ) : data ? (
        <CustomerBody
          detail={data}
          currency={currency}
          canDelete={role === "admin"}
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
        />
      ) : null}

      {data ? (
        <CustomerFormDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          customer={data.customer}
          onSaved={(c: Customer) =>
            setData({ ...data, customer: c })
          }
        />
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete customer?"
        description="This soft-deletes the customer. It's blocked if they still have non-void invoices."
        confirmLabel="Delete customer"
        variant="danger"
      />
    </div>
  );
}

function CustomerBody({
  detail,
  currency,
  canDelete,
  onEdit,
  onDelete,
}: {
  detail: CustomerDetail;
  currency: string;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const { customer, invoices, totals } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {customer.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-4 text-muted-2" aria-hidden />
              {customer.email}
            </span>
            {customer.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4 text-muted-2" aria-hidden />
                {customer.phone}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden />
            Edit
          </Button>
          <ButtonLink href={`/invoices/new?customer=${customer.id}`}>
            <FilePlus2 className="size-4" aria-hidden />
            New invoice
          </ButtonLink>
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label="Delete customer"
              className="text-muted-2 hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TotalTile label="Total billed" value={formatMoney(totals.billed, currency)} />
        <TotalTile
          label="Total paid"
          value={formatMoney(totals.paid, currency)}
          tone="success"
        />
        <TotalTile
          label="Outstanding"
          value={formatMoney(totals.outstanding, currency)}
          tone={totals.outstanding > 0 ? "primary" : "muted"}
        />
      </div>

      {(customer.billingAddress || customer.notes) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {customer.billingAddress ? (
            <Card className="p-5">
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-2">
                <MapPin className="size-3.5" aria-hidden />
                Billing address
              </p>
              <p className="whitespace-pre-line text-sm text-foreground">
                {customer.billingAddress}
              </p>
            </Card>
          ) : null}
          {customer.notes ? (
            <Card className="p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">
                Notes
              </p>
              <p className="whitespace-pre-line text-sm text-foreground">
                {customer.notes}
              </p>
            </Card>
          ) : null}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[0.9375rem] font-semibold text-foreground">
            Invoice history
          </h2>
        </div>
        {invoices.length === 0 ? (
          <EmptyState
            icon={FilePlus2}
            title="No invoices yet"
            description={`You haven't billed ${customer.name} yet.`}
            action={
              <ButtonLink href={`/invoices/new?customer=${customer.id}`}>
                <FilePlus2 className="size-4" aria-hidden />
                New invoice
              </ButtonLink>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Invoice</TH>
                <TH className="hidden sm:table-cell">Issued</TH>
                <TH>Status</TH>
                <TH className="text-right">Total</TH>
                <TH className="hidden text-right sm:table-cell">Outstanding</TH>
              </TR>
            </THead>
            <TBody>
              {invoices.map((inv) => (
                <TR
                  key={inv.id}
                  interactive
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  <TD className="font-mono text-[0.8125rem] font-medium">
                    {inv.number ?? "Draft"}
                  </TD>
                  <TD className="hidden text-muted sm:table-cell">
                    {formatDate(inv.issueDate)}
                  </TD>
                  <TD>
                    <StatusBadge
                      status={toDisplayStatus(inv.status, inv.dueDate)}
                    />
                  </TD>
                  <TD className="text-right font-medium tabular">
                    {formatMoney(inv.total, inv.currency)}
                  </TD>
                  <TD className="hidden text-right text-muted tabular sm:table-cell">
                    {inv.outstanding > 0
                      ? formatMoney(inv.outstanding, inv.currency)
                      : "—"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function TotalTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "primary" | "muted";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "primary"
        ? "text-primary"
        : tone === "muted"
          ? "text-muted-2"
          : "text-foreground";
  return (
    <Card className="p-5">
      <p className="text-[0.8125rem] font-medium text-muted">{label}</p>
      <p
        className={`mt-1.5 font-display text-2xl font-semibold tracking-tight tabular ${color}`}
      >
        {value}
      </p>
    </Card>
  );
}
