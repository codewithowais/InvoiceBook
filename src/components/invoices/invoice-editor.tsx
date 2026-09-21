"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, Send, UserPlus } from "lucide-react";
import { apiGet, apiPatch, apiPost, asArray, ApiError } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import { useBusiness } from "@/components/app-shell/business-context";
import type { CustomerListItem, InvoiceDetail } from "@/lib/types";
import { computeTotals } from "@/lib/money";
import { formatMoney, toMinor } from "@/lib/money";
import { toISODate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { LoadingBlock } from "@/components/ui/spinner";
import {
  newItem,
  itemFromStored,
  toApiItems,
  toComputeItem,
  type EditorItem,
} from "./editor-utils";
import { LineItemsEditor } from "./line-items-editor";
import { ProductPicker, type PickedProduct } from "@/components/products/product-picker";
import { getCurrencySymbol } from "@/lib/currency";

type DiscountType = "none" | "flat" | "percent";

function defaultDates() {
  const today = new Date();
  return {
    issueDate: toISODate(today),
    dueDate: toISODate(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30),
    ),
  };
}

export function InvoiceEditor({
  mode,
  invoice,
  presetCustomerId,
}: {
  mode: "create" | "edit";
  invoice?: InvoiceDetail;
  presetCustomerId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const business = useBusiness();

  const defaults = useMemo(defaultDates, []);
  const inv = invoice?.invoice;

  const [customerId, setCustomerId] = useState(
    inv?.customerId ?? presetCustomerId ?? "",
  );
  const [issueDate, setIssueDate] = useState(inv?.issueDate ?? defaults.issueDate);
  const [dueDate, setDueDate] = useState(inv?.dueDate ?? defaults.dueDate);
  const [items, setItems] = useState<EditorItem[]>(
    invoice?.items?.length
      ? invoice.items.map(itemFromStored)
      : [newItem()],
  );
  const [discountType, setDiscountType] = useState<DiscountType>(
    (inv?.discountType as DiscountType) ?? "none",
  );
  const [discountValue, setDiscountValue] = useState(
    inv && inv.discountValue
      ? inv.discountType === "percent"
        ? String(inv.discountValue / 100)
        : String(inv.discountValue / 100)
      : "",
  );
  const [notes, setNotes] = useState(inv?.notes ?? "");
  const [terms, setTerms] = useState(inv?.terms ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<null | "draft" | "finalize">(null);

  const currency = inv?.currency ?? business.currency;
  const symbol = getCurrencySymbol(currency);

  const customersQuery = useAsync<CustomerListItem[]>(async () => {
    const res = await apiGet<CustomerListItem[] | { items: CustomerListItem[] }>(
      "/api/customers",
    );
    return asArray(res);
  }, []);

  const discountValueForCompute =
    discountType === "none"
      ? 0
      : discountType === "flat"
        ? toMinor(discountValue || "0")
        : Math.round((parseFloat(discountValue || "0") || 0) * 100);

  const totals = useMemo(
    () =>
      computeTotals({
        items: items.map(toComputeItem),
        discountType,
        discountValue: discountValueForCompute,
      }),
    [items, discountType, discountValueForCompute],
  );

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!customerId) next.customerId = "Choose a customer";
    if (!issueDate) next.issueDate = "Issue date is required";
    if (!dueDate) next.dueDate = "Due date is required";
    if (issueDate && dueDate && dueDate < issueDate)
      next.dueDate = "Due date can't be before the issue date";

    const validItems = items.filter((it) => it.description.trim());
    if (validItems.length === 0) {
      next.items = "Add at least one line item with a description";
    } else {
      for (const it of items) {
        if (it.description.trim()) {
          const c = toComputeItem(it);
          if (c.quantity <= 0) {
            next.items = "Every line needs a quantity greater than zero";
            break;
          }
          if (c.unitPrice < 0) {
            next.items = "Unit prices can't be negative";
            break;
          }
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildPayload() {
    const apiItems = toApiItems(items.filter((it) => it.description.trim()));
    return {
      customerId,
      issueDate,
      dueDate,
      currency,
      items: apiItems,
      discountType,
      discountValue: discountValueForCompute,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
    };
  }

  async function handleSave(finalize: boolean) {
    if (!validate()) {
      toast({
        variant: "warning",
        title: "Check the form",
        description: "A few fields need your attention.",
      });
      return;
    }
    setPending(finalize ? "finalize" : "draft");
    try {
      const payload = buildPayload();
      let invoiceId = inv?.id;

      if (mode === "edit" && invoiceId) {
        await apiPatch<InvoiceDetail>(`/api/invoices/${invoiceId}`, payload);
      } else {
        const created = await apiPost<{ id: string } & Record<string, unknown>>(
          "/api/invoices",
          payload,
        );
        invoiceId = created.id;
      }

      if (finalize && invoiceId) {
        await apiPost(`/api/invoices/${invoiceId}/finalize`);
        toast({
          variant: "success",
          title: "Invoice finalized",
          description: "It's now locked and ready to share.",
        });
      } else {
        toast({
          variant: "success",
          title: mode === "edit" ? "Draft saved" : "Draft created",
        });
      }

      router.push(invoiceId ? `/invoices/${invoiceId}` : "/invoices");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) setErrors((p) => ({ ...p, ...err.fieldErrors() }));
        toast({
          variant: "error",
          title: "Couldn't save invoice",
          description: err.message,
        });
      } else {
        toast({ variant: "error", title: "Couldn't save invoice" });
      }
    } finally {
      setPending(null);
    }
  }

  function addFromProduct(picked: PickedProduct) {
    const row = itemFromStored(picked);
    setItems((prev) => {
      const emptyIdx = prev.findIndex(
        (it) => !it.description.trim() && !it.unitPrice.trim(),
      );
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = { ...row, key: prev[emptyIdx].key };
        return next;
      }
      return [...prev, row];
    });
  }

  const customers = customersQuery.data ?? [];
  const busy = pending !== null;

  return (
    <div>
      <Link
        href={inv ? `/invoices/${inv.id}` : "/invoices"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {inv ? "Back to invoice" : "Invoices"}
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {mode === "edit" ? "Edit draft invoice" : "New invoice"}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            The invoice number is assigned automatically when you finalize.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Main form */}
        <div className="min-w-0 space-y-6">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <Label htmlFor="invoice-customer" required>
                    Customer
                  </Label>
                  <Link
                    href="/customers"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
                  >
                    <UserPlus className="size-3.5" aria-hidden />
                    Manage
                  </Link>
                </div>
                {customersQuery.loading ? (
                  <div className="h-10 animate-pulse rounded-lg bg-surface-3" />
                ) : customers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 px-3 py-3 text-sm text-muted">
                    No customers yet.{" "}
                    <Link
                      href="/customers"
                      className="font-medium text-primary hover:underline"
                    >
                      Add one first
                    </Link>
                    .
                  </div>
                ) : (
                  <Select
                    id="invoice-customer"
                    value={customerId}
                    invalid={Boolean(errors.customerId)}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="" disabled>
                      Select a customer…
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.email}
                      </option>
                    ))}
                  </Select>
                )}
                {errors.customerId ? (
                  <p role="alert" className="mt-1 text-xs font-medium text-danger">
                    {errors.customerId}
                  </p>
                ) : null}
              </div>

              <Field label="Issue date" required error={errors.issueDate}>
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    value={issueDate}
                    invalid={Boolean(errors.issueDate)}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                )}
              </Field>
              <Field
                label="Due date"
                required
                error={errors.dueDate}
                hint="Defaults to 30 days after issue"
              >
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    value={dueDate}
                    invalid={Boolean(errors.dueDate)}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                )}
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-[0.9375rem] font-semibold text-foreground">
              Line items
            </h2>
            <LineItemsEditor
              items={items}
              currency={currency}
              onChange={setItems}
              error={errors.items}
              extraAction={
                <ProductPicker currency={currency} onPick={addFromProduct} />
              }
            />
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-[0.9375rem] font-semibold text-foreground">
              Notes &amp; terms
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Notes" hint="Shown on the invoice">
                {(props) => (
                  <Textarea
                    {...props}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Thanks for your business!"
                  />
                )}
              </Field>
              <Field label="Payment terms" hint="Shown on the invoice">
                {(props) => (
                  <Textarea
                    {...props}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Net 30. Bank transfer preferred."
                  />
                )}
              </Field>
            </div>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-[0.9375rem] font-semibold text-foreground">
                Summary
              </h2>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />

              <div>
                <Label
                  htmlFor="discount-type"
                  className="mb-1.5 text-xs uppercase tracking-wide text-muted-2"
                >
                  Discount
                </Label>
                <div className="flex gap-2">
                  <Select
                    id="discount-type"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                    className="h-9 flex-1"
                  >
                    <option value="none">None</option>
                    <option value="flat">Flat</option>
                    <option value="percent">Percent</option>
                  </Select>
                  {discountType !== "none" ? (
                    <Input
                      aria-label="Discount value"
                      type="text"
                      inputMode="decimal"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      prefix={discountType === "flat" ? symbol : undefined}
                      placeholder={discountType === "percent" ? "%" : "0.00"}
                      className="h-9 w-24 text-right tabular"
                    />
                  ) : null}
                </div>
              </div>

              {totals.discount > 0 ? (
                <Row
                  label="Discount"
                  value={`− ${formatMoney(totals.discount, currency)}`}
                  valueClass="text-success"
                />
              ) : null}
              <Row label="Tax" value={formatMoney(totals.taxTotal, currency)} />

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-display text-xl font-semibold text-foreground tabular">
                  {formatMoney(totals.total, currency)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border bg-surface-2 px-5 py-4">
              <Button
                type="button"
                onClick={() => handleSave(true)}
                loading={pending === "finalize"}
                disabled={busy}
              >
                <Send className="size-4" aria-hidden />
                {mode === "edit" ? "Finalize invoice" : "Save & finalize"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSave(false)}
                loading={pending === "draft"}
                disabled={busy}
              >
                Save as draft
              </Button>
              <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-2">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Finalizing locks the number and amounts. Drafts stay editable.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
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

/** Loading placeholder for the edit page while the invoice fetches. */
export function InvoiceEditorLoading() {
  return (
    <Card>
      <LoadingBlock label="Loading invoice…" />
    </Card>
  );
}
