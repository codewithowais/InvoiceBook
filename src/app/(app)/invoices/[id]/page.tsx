"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Download,
  FileText,
  ImageIcon,
  Mail,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import { useBusiness } from "@/components/app-shell/business-context";
import type { InvoiceDetail, PaymentWithProof } from "@/lib/types";
import { formatMoney, formatQty } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { toDisplayStatus, PAYMENT_METHOD_LABELS } from "@/lib/invoice-ui";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingBlock } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";
import { SendInvoiceDialog } from "@/components/invoices/send-invoice-dialog";
import { useToast } from "@/components/ui/toast";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { role } = useBusiness();
  const { toast } = useToast();

  const { data, loading, error, refetch } = useAsync<InvoiceDetail>(
    () => apiGet<InvoiceDetail>(`/api/invoices/${id}`),
    [id],
  );

  const [payOpen, setPayOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [voidPayment, setVoidPayment] = useState<PaymentWithProof | null>(null);

  async function doFinalize() {
    try {
      await apiPost(`/api/invoices/${id}/finalize`);
      toast({ variant: "success", title: "Invoice finalized" });
      setFinalizeOpen(false);
      refetch();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't finalize",
        description: err instanceof ApiError ? err.message : undefined,
      });
      setFinalizeOpen(false);
    }
  }

  async function doDelete() {
    try {
      await apiPatch(`/api/invoices/${id}/delete`);
      toast({ variant: "success", title: "Invoice deleted" });
      router.push("/invoices");
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't delete",
        description: err instanceof ApiError ? err.message : undefined,
      });
      setDeleteOpen(false);
    }
  }

  async function doVoid() {
    if (!voidPayment) return;
    try {
      await apiPatch(`/api/payments/${voidPayment.id}/void`);
      toast({ variant: "success", title: "Payment voided" });
      setVoidPayment(null);
      refetch();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't void payment",
        description: err instanceof ApiError ? err.message : undefined,
      });
      setVoidPayment(null);
    }
  }

  return (
    <div>
      <Link
        href="/invoices"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Invoices
      </Link>

      {loading ? (
        <Card>
          <LoadingBlock label="Loading invoice…" />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState description={error} onRetry={refetch} />
        </Card>
      ) : data ? (
        <InvoiceBody
          detail={data}
          canDelete={role === "admin"}
          onRecordPayment={() => setPayOpen(true)}
          onSend={() => setSendOpen(true)}
          onFinalize={() => setFinalizeOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          onVoid={(p) => setVoidPayment(p)}
        />
      ) : null}

      {data ? (
        <RecordPaymentDialog
          open={payOpen}
          onClose={() => setPayOpen(false)}
          invoiceId={id}
          currency={data.invoice.currency}
          outstanding={data.outstanding}
          onRecorded={refetch}
        />
      ) : null}

      {data ? (
        <SendInvoiceDialog
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          invoiceId={id}
          invoiceNumber={data.invoice.number ?? "Draft"}
          customerEmail={data.customer?.email ?? null}
          onSent={refetch}
        />
      ) : null}

      <ConfirmDialog
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        onConfirm={doFinalize}
        title="Finalize this invoice?"
        description="A number will be assigned and the amounts locked. You can still record payments afterwards, but you won't be able to edit line items."
        confirmLabel="Finalize invoice"
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={doDelete}
        title="Delete this invoice?"
        description="Drafts delete freely. Finalized invoices can only be deleted if they have no active payments."
        confirmLabel="Delete invoice"
        variant="danger"
      />
      <ConfirmDialog
        open={Boolean(voidPayment)}
        onClose={() => setVoidPayment(null)}
        onConfirm={doVoid}
        title="Void this payment?"
        description="The invoice balance and status will recalculate. This keeps an audit trail — the payment isn't deleted."
        confirmLabel="Void payment"
        variant="danger"
      />
    </div>
  );
}

function InvoiceBody({
  detail,
  canDelete,
  onRecordPayment,
  onSend,
  onFinalize,
  onDelete,
  onVoid,
}: {
  detail: InvoiceDetail;
  canDelete: boolean;
  onRecordPayment: () => void;
  onSend: () => void;
  onFinalize: () => void;
  onDelete: () => void;
  onVoid: (p: PaymentWithProof) => void;
}) {
  const { invoice, items, payments, customer, outstanding } = detail;
  const { createdByName, updatedByName } = detail;
  const currency = invoice.currency;
  const isDraft = invoice.status === "draft";
  const isVoid = invoice.status === "void";
  const canPay =
    invoice.status === "unpaid" || invoice.status === "partially_paid";
  const display = toDisplayStatus(invoice.status, invoice.dueDate);
  const activePayments = payments.filter((p) => p.status === "active");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isDraft ? "Draft" : "Invoice"}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{invoice.number ?? "Draft"}</span>
            <StatusBadge status={display} />
          </span>
        }
        description={
          customer ? (
            <>
              Billed to{" "}
              <Link
                href={`/customers/${customer.id}`}
                className="font-medium text-foreground hover:text-primary hover:underline"
              >
                {customer.name}
              </Link>
            </>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!isDraft ? (
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("outline", "md")}
              >
                <Download className="size-4" aria-hidden />
                PDF
              </a>
            ) : null}
            {!isDraft && !isVoid ? (
              <Button variant="outline" onClick={onSend}>
                <Send className="size-4" aria-hidden />
                {invoice.sentAt ? "Resend" : "Send"}
              </Button>
            ) : null}
            {isDraft ? (
              <>
                <ButtonLink href={`/invoices/${invoice.id}/edit`} variant="outline">
                  <Pencil className="size-4" aria-hidden />
                  Edit
                </ButtonLink>
                <Button onClick={onFinalize}>
                  <CheckCircle2 className="size-4" aria-hidden />
                  Finalize
                </Button>
              </>
            ) : null}
            {canPay ? (
              <Button onClick={onRecordPayment}>
                <Plus className="size-4" aria-hidden />
                Record payment
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                aria-label="Delete invoice"
                className="text-muted-2 hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        }
      />

      {isVoid ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm text-muted"
        >
          <Ban className="size-4" aria-hidden />
          This invoice has been voided.
        </div>
      ) : invoice.sentAt ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm text-muted"
        >
          <Mail className="size-4 text-success" aria-hidden />
          Emailed to the customer on {formatDate(invoice.sentAt)}.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {/* Meta */}
          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            <Meta label="Issued" value={formatDate(invoice.issueDate)} />
            <Meta label="Due" value={formatDate(invoice.dueDate)} />
            <Meta
              label="Currency"
              value={<span className="font-mono">{currency}</span>}
            />
            <Meta
              label="Status"
              value={<StatusBadge status={display} withDot={false} />}
            />
          </Card>

          {/* Line items */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-[0.9375rem] font-semibold text-foreground">
                Line items
              </h2>
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Description</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="hidden text-right sm:table-cell">Unit</TH>
                  <TH className="hidden text-right sm:table-cell">Tax</TH>
                  <TH className="text-right">Amount</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((it) => (
                  <TR key={it.id}>
                    <TD className="font-medium">{it.description}</TD>
                    <TD className="text-right tabular">{formatQty(it.quantity)}</TD>
                    <TD className="hidden text-right tabular sm:table-cell">
                      {formatMoney(it.unitPrice, currency)}
                    </TD>
                    <TD className="hidden text-right tabular text-muted sm:table-cell">
                      {it.taxRateBps ? `${it.taxRateBps / 100}%` : "—"}
                    </TD>
                    <TD className="text-right font-medium tabular">
                      {formatMoney(it.lineTotal, currency)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          {/* Payments */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-[0.9375rem] font-semibold text-foreground">
                Payment history
              </h2>
              {canPay ? (
                <Button variant="ghost" size="sm" onClick={onRecordPayment}>
                  <Plus className="size-4" aria-hidden />
                  Add
                </Button>
              ) : null}
            </div>
            {payments.length === 0 ? (
              <EmptyState
                title="No payments yet"
                description={
                  canPay
                    ? "Record a payment and attach proof to keep your records complete."
                    : "Payments will appear here once recorded."
                }
                action={
                  canPay ? (
                    <Button variant="outline" size="sm" onClick={onRecordPayment}>
                      <Plus className="size-4" aria-hidden />
                      Record payment
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {payments.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    currency={currency}
                    onVoid={() => onVoid(p)}
                  />
                ))}
              </ul>
            )}
          </Card>

          {(invoice.notes || invoice.terms) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {invoice.notes ? (
                <Card className="p-5">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-2">
                    Notes
                  </p>
                  <p className="whitespace-pre-line text-sm text-foreground">
                    {invoice.notes}
                  </p>
                </Card>
              ) : null}
              {invoice.terms ? (
                <Card className="p-5">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-2">
                    Terms
                  </p>
                  <p className="whitespace-pre-line text-sm text-foreground">
                    {invoice.terms}
                  </p>
                </Card>
              ) : null}
            </div>
          )}

          {createdByName || updatedByName ? (
            <p className="text-xs text-muted-2">
              {createdByName ? `Created by ${createdByName}` : null}
              {createdByName && updatedByName ? " · " : null}
              {updatedByName ? `Last updated by ${updatedByName}` : null}
            </p>
          ) : null}
        </div>

        {/* Totals sidebar */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-[0.9375rem] font-semibold text-foreground">
                Totals
              </h2>
            </div>
            <div className="space-y-2.5 px-5 py-4 text-sm">
              <SummaryRow
                label="Subtotal"
                value={formatMoney(invoice.subtotal, currency)}
              />
              {invoice.discountValue > 0 && invoice.discountType !== "none" ? (
                <SummaryRow
                  label={`Discount${
                    invoice.discountType === "percent"
                      ? ` (${invoice.discountValue / 100}%)`
                      : ""
                  }`}
                  value={`− ${formatMoney(
                    invoice.subtotal + invoice.taxTotal - invoice.total,
                    currency,
                  )}`}
                  valueClass="text-success"
                />
              ) : null}
              <SummaryRow
                label="Tax"
                value={formatMoney(invoice.taxTotal, currency)}
              />
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-display text-xl font-semibold text-foreground tabular">
                  {formatMoney(invoice.total, currency)}
                </span>
              </div>
              <SummaryRow
                label="Paid"
                value={formatMoney(invoice.amountPaid, currency)}
                valueClass="text-success"
              />
              <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5">
                <span className="font-medium text-foreground">Outstanding</span>
                <span className="font-semibold text-foreground tabular">
                  {formatMoney(outstanding, currency)}
                </span>
              </div>
              {activePayments.length > 0 ? (
                <p className="pt-1 text-xs text-muted-2">
                  {activePayments.length} payment
                  {activePayments.length === 1 ? "" : "s"} recorded
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PaymentRow({
  payment,
  currency,
  onVoid,
}: {
  payment: PaymentWithProof;
  currency: string;
  onVoid: () => void;
}) {
  const isVoid = payment.status === "void";
  const isPdf = payment.proofContentType === "application/pdf";
  const proofHref = payment.proofUrl || `/api/payments/${payment.id}/proof`;

  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <a
        href={proofHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open proof: ${payment.proofFileName ?? "attachment"}`}
        className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2 text-muted-2 transition-colors hover:border-primary/40 hover:text-primary"
      >
        {isPdf ? (
          <FileText className="size-5" aria-hidden />
        ) : (
          <ImageIcon className="size-5" aria-hidden />
        )}
      </a>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold tabular ${
            isVoid ? "text-muted-2 line-through" : "text-foreground"
          }`}
        >
          {formatMoney(payment.amount, currency)}
        </p>
        <p className="truncate text-xs text-muted-2">
          {formatDate(payment.paidAt)} ·{" "}
          {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
          {payment.reference ? ` · ${payment.reference}` : ""}
        </p>
      </div>
      {isVoid ? (
        <span className="rounded-full bg-[var(--status-void-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-void-fg)]">
          Voided
        </span>
      ) : (
        <button
          type="button"
          onClick={onVoid}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-2 transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <Ban className="size-3.5" aria-hidden />
          Void
        </button>
      )}
    </li>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-2">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`font-medium text-foreground tabular ${valueClass ?? ""}`}>
        {value}
      </span>
    </div>
  );
}
