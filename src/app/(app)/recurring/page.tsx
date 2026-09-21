"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Plus, Repeat, Zap } from "lucide-react";
import { apiGet, apiPost, asArray, ApiError } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import type { RecurringPlanListItem } from "@/lib/types";
import { computeTotals, formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

const STATUS_VARIANT = {
  active: "success",
  paused: "warning",
  ended: "neutral",
} as const;

function planTotal(plan: RecurringPlanListItem) {
  const totals = computeTotals({
    items: (plan.items ?? []).map((it) => ({
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      taxRateBps: it.taxRateBps,
    })),
    discountType: "none",
    discountValue: 0,
  });
  return totals.total;
}

export default function RecurringPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useAsync<RecurringPlanListItem[]>(
    async () => {
      const res = await apiGet<
        RecurringPlanListItem[] | { items: RecurringPlanListItem[] }
      >("/api/recurring-plans");
      return asArray(res);
    },
    [],
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [generatePlan, setGeneratePlan] = useState<RecurringPlanListItem | null>(
    null,
  );

  const plans = data ?? [];

  async function toggle(plan: RecurringPlanListItem) {
    const action = plan.status === "active" ? "pause" : "resume";
    setBusyId(plan.id);
    try {
      await apiPost(`/api/recurring-plans/${plan.id}/${action}`);
      toast({
        variant: "success",
        title: action === "pause" ? "Plan paused" : "Plan resumed",
      });
      refetch();
    } catch (err) {
      toast({
        variant: "error",
        title: "Action failed",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  }

  async function generateNow() {
    if (!generatePlan) return;
    try {
      await apiPost(`/api/recurring-plans/${generatePlan.id}/generate`);
      toast({
        variant: "success",
        title: "Invoice generated",
        description: "A new invoice was created from this plan.",
      });
      setGeneratePlan(null);
      refetch();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't generate",
        description: err instanceof ApiError ? err.message : undefined,
      });
      setGeneratePlan(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Automation"
        title="Recurring plans"
        description="Bill customers on a monthly cycle — invoices generate themselves."
        actions={
          <ButtonLink href="/recurring/new">
            <Plus className="size-4" aria-hidden />
            New plan
          </ButtonLink>
        }
      />

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : error ? (
          <ErrorState description={error} onRetry={refetch} />
        ) : plans.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="No recurring plans yet"
            description="Set up a monthly plan and stop creating the same invoice by hand."
            action={
              <ButtonLink href="/recurring/new">
                <Plus className="size-4" aria-hidden />
                New plan
              </ButtonLink>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH>Status</TH>
                <TH className="hidden text-right sm:table-cell">Next run</TH>
                <TH className="hidden text-right md:table-cell">Amount</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {plans.map((plan) => (
                <TR key={plan.id}>
                  <TD>
                    <button
                      type="button"
                      onClick={() => router.push(`/recurring/${plan.id}/edit`)}
                      className="text-left"
                    >
                      <p className="font-medium text-foreground hover:text-primary">
                        {plan.customerName}
                      </p>
                      <p className="text-xs text-muted-2">
                        {plan.cyclesRun} generated · monthly
                      </p>
                    </button>
                  </TD>
                  <TD>
                    <Badge variant={STATUS_VARIANT[plan.status]}>
                      <span className="capitalize">{plan.status}</span>
                    </Badge>
                  </TD>
                  <TD className="hidden text-right text-muted sm:table-cell">
                    {plan.status === "ended"
                      ? "—"
                      : formatDate(plan.nextRunDate)}
                  </TD>
                  <TD className="hidden text-right font-medium tabular md:table-cell">
                    {formatMoney(planTotal(plan), plan.currency)}
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      {plan.status !== "ended" ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={busyId === plan.id}
                            onClick={() => toggle(plan)}
                          >
                            {plan.status === "active" ? (
                              <>
                                <Pause className="size-4" aria-hidden />
                                <span className="hidden sm:inline">Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="size-4" aria-hidden />
                                <span className="hidden sm:inline">Resume</span>
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setGeneratePlan(plan)}
                          >
                            <Zap className="size-4" aria-hidden />
                            <span className="hidden sm:inline">Generate</span>
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-2">Completed</span>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(generatePlan)}
        onClose={() => setGeneratePlan(null)}
        onConfirm={generateNow}
        title="Generate an invoice now?"
        description={
          generatePlan
            ? `This creates the next finalized invoice for ${generatePlan.customerName} immediately, without waiting for the schedule.`
            : ""
        }
        confirmLabel="Generate invoice"
      />
    </div>
  );
}
