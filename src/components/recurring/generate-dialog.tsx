"use client";

import { useState } from "react";
import { apiPost, ApiError } from "@/lib/fetcher";
import { computeTotals, formatMoney } from "@/lib/money";
import { formatDate, toISODate } from "@/lib/format";
import type { RecurringPlanListItem } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

function addDaysISO(iso: string, days: number): string {
  return toISODate(new Date(new Date(iso).getTime() + days * 86_400_000));
}

/**
 * Manually generate an invoice from a recurring plan for a chosen month. The
 * issue date defaults to the plan's next scheduled run; the invoice is due 30
 * days after, and the plan's automatic schedule advances one cycle.
 */
export function GenerateInvoiceDialog({
  plan,
  onClose,
  onGenerated,
}: {
  plan: RecurringPlanListItem | null;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const { toast } = useToast();
  const [issueDate, setIssueDate] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset the default issue date each time the dialog opens (render pattern).
  const [wasOpenFor, setWasOpenFor] = useState<string | null>(null);
  const openFor = plan?.id ?? null;
  if (openFor !== wasOpenFor) {
    setWasOpenFor(openFor);
    if (plan) {
      setIssueDate(plan.nextRunDate ?? toISODate(new Date()));
      setBusy(false);
    }
  }

  if (!plan) return null;

  const total = computeTotals({
    items: (plan.items ?? []).map((it) => ({
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      taxRateBps: it.taxRateBps,
    })),
    discountType: "none",
    discountValue: 0,
  }).total;
  const dueDate = issueDate ? addDaysISO(issueDate, 30) : "";

  async function onGenerate() {
    if (!plan || !issueDate) return;
    setBusy(true);
    try {
      await apiPost(`/api/recurring-plans/${plan.id}/generate`, { issueDate });
      toast({
        variant: "success",
        title: "Invoice generated",
        description: `${formatMoney(total, plan.currency)} for ${plan.customerName}, dated ${formatDate(issueDate)}.`,
      });
      onGenerated();
      onClose();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't generate",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={Boolean(plan)}
      onClose={onClose}
      dismissible={!busy}
      title="Generate an invoice"
      description={`Create this month's invoice for ${plan.customerName} — ${formatMoney(total, plan.currency)}.`}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={onGenerate} loading={busy} disabled={!issueDate}>
            Generate invoice
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Invoice month / issue date"
          hint="Pick the month this invoice is for. Defaults to the next scheduled run."
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          )}
        </Field>

        <div className="rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-xs text-muted">
          <p className="mb-1.5 font-medium text-foreground">What happens</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>Creates a finalized, unpaid invoice dated <span className="font-medium text-foreground">{formatDate(issueDate)}</span>, due <span className="font-medium text-foreground">{formatDate(dueDate)}</span>.</li>
            <li>Uses the plan&apos;s current line items and customer.</li>
            <li>Advances the plan&apos;s next automatic run by one month.</li>
            {plan.autoEmail ? <li>Emails the invoice to the customer (auto-email is on).</li> : null}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
