"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, UserPlus } from "lucide-react";
import { apiGet, apiPatch, apiPost, asArray, ApiError } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import { useBusiness } from "@/components/app-shell/business-context";
import type { CustomerListItem, RecurringPlan } from "@/lib/types";
import { computeTotals, formatMoney } from "@/lib/money";
import { toISODate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  newItem,
  itemFromStored,
  toApiItems,
  toComputeItem,
  type EditorItem,
} from "@/components/invoices/editor-utils";
import { LineItemsEditor } from "@/components/invoices/line-items-editor";
import { ProductPicker, type PickedProduct } from "@/components/products/product-picker";

type EndMode = "never" | "endDate" | "maxCycles";

export function PlanEditor({
  mode,
  plan,
}: {
  mode: "create" | "edit";
  plan?: RecurringPlan;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const business = useBusiness();

  const [customerId, setCustomerId] = useState(plan?.customerId ?? "");
  const [startDate, setStartDate] = useState(
    plan?.startDate ?? toISODate(new Date()),
  );
  const [endMode, setEndMode] = useState<EndMode>(
    plan?.endDate ? "endDate" : plan?.maxCycles ? "maxCycles" : "never",
  );
  const [endDate, setEndDate] = useState(plan?.endDate ?? "");
  const [maxCycles, setMaxCycles] = useState(
    plan?.maxCycles ? String(plan.maxCycles) : "",
  );
  const [items, setItems] = useState<EditorItem[]>(
    plan?.items?.length
      ? plan.items.map(itemFromStored)
      : [newItem()],
  );
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [terms, setTerms] = useState(plan?.terms ?? "");
  const [autoEmail, setAutoEmail] = useState<boolean>(plan?.autoEmail ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const currency = plan?.currency ?? business.currency;

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

  const customersQuery = useAsync<CustomerListItem[]>(async () => {
    const res = await apiGet<CustomerListItem[] | { items: CustomerListItem[] }>(
      "/api/customers",
    );
    return asArray(res);
  }, [], "customers:");
  const customers = customersQuery.data ?? [];

  const totals = useMemo(
    () =>
      computeTotals({
        items: items.map(toComputeItem),
        discountType: "none",
        discountValue: 0,
      }),
    [items],
  );

  function validate() {
    const next: Record<string, string> = {};
    if (!customerId) next.customerId = "Choose a customer";
    if (!startDate) next.startDate = "Start date is required";
    if (endMode === "endDate" && !endDate) next.endDate = "Pick an end date";
    if (endMode === "endDate" && endDate && endDate < startDate)
      next.endDate = "End date can't be before the start date";
    if (endMode === "maxCycles" && (!maxCycles || parseInt(maxCycles, 10) < 1))
      next.maxCycles = "Enter a number of cycles (1 or more)";
    const valid = items.filter((it) => it.description.trim());
    if (valid.length === 0) next.items = "Add at least one line item";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      toast({ variant: "warning", title: "Check the form" });
      return;
    }
    setSaving(true);
    const payload = {
      customerId,
      currency,
      startDate,
      endDate: endMode === "endDate" ? endDate : null,
      maxCycles: endMode === "maxCycles" ? parseInt(maxCycles, 10) : null,
      autoEmail,
      items: toApiItems(items.filter((it) => it.description.trim())),
      notes: notes.trim() || null,
      terms: terms.trim() || null,
    };
    try {
      const saved =
        mode === "edit" && plan
          ? await apiPatch<RecurringPlan>(`/api/recurring-plans/${plan.id}`, payload)
          : await apiPost<RecurringPlan>("/api/recurring-plans", payload);
      toast({
        variant: "success",
        title: mode === "edit" ? "Plan updated" : "Recurring plan created",
      });
      router.push(saved?.id ? `/recurring` : "/recurring");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) setErrors((p) => ({ ...p, ...err.fieldErrors() }));
        toast({
          variant: "error",
          title: "Couldn't save plan",
          description: err.message,
        });
      } else {
        toast({ variant: "error", title: "Couldn't save plan" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link
        href="/recurring"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Recurring plans
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          {mode === "edit" ? "Edit recurring plan" : "New recurring plan"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Each cycle generates a finalized, unpaid invoice automatically.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <Label htmlFor="plan-customer" required>
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
                    <Link href="/customers" className="font-medium text-primary hover:underline">
                      Add one first
                    </Link>
                    .
                  </div>
                ) : (
                  <Select
                    id="plan-customer"
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

              <Field label="Start date" required error={errors.startDate}>
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    value={startDate}
                    invalid={Boolean(errors.startDate)}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Billing cycle">
                {(props) => (
                  <Select {...props} value="monthly" disabled>
                    <option value="monthly">Monthly</option>
                  </Select>
                )}
              </Field>
            </div>

            <div className="mt-4">
              <Label className="mb-1.5">Ends</Label>
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr] sm:items-start">
                <Select
                  aria-label="End condition"
                  value={endMode}
                  onChange={(e) => setEndMode(e.target.value as EndMode)}
                >
                  <option value="never">Never (until paused)</option>
                  <option value="endDate">On a date</option>
                  <option value="maxCycles">After N invoices</option>
                </Select>
                {endMode === "endDate" ? (
                  <Field error={errors.endDate}>
                    {(props) => (
                      <Input
                        {...props}
                        type="date"
                        value={endDate}
                        invalid={Boolean(errors.endDate)}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    )}
                  </Field>
                ) : endMode === "maxCycles" ? (
                  <Field error={errors.maxCycles}>
                    {(props) => (
                      <Input
                        {...props}
                        type="number"
                        min={1}
                        value={maxCycles}
                        invalid={Boolean(errors.maxCycles)}
                        onChange={(e) => setMaxCycles(e.target.value)}
                        placeholder="e.g. 12"
                      />
                    )}
                  </Field>
                ) : (
                  <p className="pt-2.5 text-sm text-muted-2">
                    Runs every month until you pause it.
                  </p>
                )}
              </div>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Notes" hint="Copied onto each invoice">
                {(props) => (
                  <Textarea
                    {...props}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Payment terms" hint="Copied onto each invoice">
                {(props) => (
                  <Textarea
                    {...props}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                  />
                )}
              </Field>
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-[0.9375rem] font-semibold text-foreground">
                Per-invoice total
              </h2>
            </div>
            <div className="space-y-2.5 px-5 py-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="font-medium tabular">
                  {formatMoney(totals.subtotal, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tax</span>
                <span className="font-medium tabular">
                  {formatMoney(totals.taxTotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-semibold text-foreground">Each month</span>
                <span className="font-display text-xl font-semibold tabular">
                  {formatMoney(totals.total, currency)}
                </span>
              </div>
            </div>

            <div className="space-y-3 border-t border-border bg-surface-2 px-5 py-4">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={autoEmail}
                  onChange={(e) => setAutoEmail(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-border-strong accent-[var(--primary)]"
                  aria-label="Auto-email each generated invoice to the customer"
                />
                <span className="text-sm">
                  <span className="font-medium text-foreground">
                    Auto-email each invoice
                  </span>
                  <span className="block text-xs text-muted-2">
                    Emails the customer the PDF when each month&apos;s invoice is
                    generated. Requires SMTP to be configured.
                  </span>
                </span>
              </label>

              <Button type="submit" loading={saving} className="w-full">
                {mode === "edit" ? "Save plan" : "Create plan"}
              </Button>
              <p className="flex items-start gap-1.5 text-xs text-muted-2">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Generated invoices are finalized automatically and start as
                unpaid.
              </p>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
