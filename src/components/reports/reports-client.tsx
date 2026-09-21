"use client";

import { useState } from "react";
import {
  BarChart3,
  CircleDollarSign,
  Download,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiGet } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { DisplayStatus } from "@/components/ui/badge";
import { ReportChart } from "./report-chart";
import { DateRangeControl, type RangeState } from "./date-range-control";
import { presetRange } from "./range";
import type { ReportSummary } from "./types";

function hasAnyData(d: ReportSummary): boolean {
  return (
    d.totals.billed !== 0 ||
    d.totals.collected !== 0 ||
    d.totals.outstanding !== 0 ||
    d.byCustomer.length > 0 ||
    d.monthly.some((m) => m.billed !== 0 || m.collected !== 0)
  );
}

export function ReportsClient() {
  const [range, setRange] = useState<RangeState>(() => {
    const { from, to } = presetRange("last_12_months");
    return { preset: "last_12_months", from, to };
  });

  const { data, loading, error, refetch } = useAsync<ReportSummary>(
    () =>
      apiGet<ReportSummary>(
        `/api/reports?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      ),
    [range.from, range.to],
  );

  const exportHref = `/api/reports/export?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;

  return (
    <div>
      <PageHeader
        eyebrow="Reporting"
        title="Reports"
        description="Billing and collections across a date range, with a breakdown by status and customer."
        actions={
          <a
            href={exportHref}
            download
            className={buttonClasses("outline", "md")}
            aria-label="Export the current report to CSV"
          >
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
        }
      />

      <div className="mb-6">
        <DateRangeControl value={range} onChange={setRange} disabled={loading} />
      </div>

      {error ? (
        <Card>
          <ErrorState
            description="We couldn't load your reports. Please try again."
            onRetry={refetch}
          />
        </Card>
      ) : loading ? (
        <ReportsSkeleton />
      ) : data && hasAnyData(data) ? (
        <ReportsBody data={data} />
      ) : (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="No data in this range"
            description="There are no finalized invoices or payments in the selected date range. Try a wider range."
          />
        </Card>
      )}
    </div>
  );
}

function ReportsBody({ data }: { data: ReportSummary }) {
  const { currency } = data.totals;
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total billed"
          icon={TrendingUp}
          tone="primary"
          value={formatMoney(data.totals.billed, currency)}
          hint="Finalized invoices issued in range"
        />
        <StatCard
          label="Total collected"
          icon={CircleDollarSign}
          tone="success"
          value={formatMoney(data.totals.collected, currency)}
          hint="Payments received in range"
        />
        <StatCard
          label="Outstanding (AR)"
          icon={Wallet}
          tone="neutral"
          value={formatMoney(data.totals.outstanding, currency)}
          hint="Currently unpaid across all invoices"
        />
      </div>

      {/* Month-by-month chart */}
      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[0.9375rem] font-semibold text-foreground">
            Billed vs collected
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Month by month over the selected range.
          </p>
        </div>
        <div className="px-5 py-5">
          <ReportChart data={data.monthly} currency={currency} />
        </div>
      </Card>

      {/* By status + top customers */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-[0.9375rem] font-semibold text-foreground">
              By status
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Current invoice book (excludes drafts).
            </p>
          </div>
          <ByStatus rows={data.byStatus} currency={currency} />
        </Card>

        <Card className="overflow-hidden lg:col-span-3">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-[0.9375rem] font-semibold text-foreground">
              Top customers
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Ranked by amount billed in range.
            </p>
          </div>
          <TopCustomers rows={data.byCustomer} currency={currency} />
        </Card>
      </div>
    </div>
  );
}

const TONE_STYLES: Record<string, { wrap: string; icon: string }> = {
  primary: {
    wrap: "bg-primary-soft text-primary-soft-fg",
    icon: "text-primary",
  },
  success: { wrap: "bg-success-soft text-success", icon: "text-success" },
  neutral: { wrap: "bg-surface-3 text-muted", icon: "text-muted-2" },
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: keyof typeof TONE_STYLES;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-muted">{label}</p>
          <p className="mt-1.5 font-display text-[1.75rem] font-semibold leading-none tracking-tight text-foreground tabular">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            styles.wrap,
          )}
        >
          <Icon className={cn("size-5", styles.icon)} aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-2">{hint}</p>
    </Card>
  );
}

function ByStatus({
  rows,
  currency,
}: {
  rows: ReportSummary["byStatus"];
  currency: string;
}) {
  if (rows.every((r) => r.count === 0)) {
    return (
      <p className="px-5 py-6 text-sm text-muted">No invoices to summarize.</p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {rows
        .filter((r) => r.count > 0)
        .map((r) => (
          <li
            key={r.status}
            className="flex items-center justify-between gap-3 px-5 py-3.5"
          >
            <div className="flex items-center gap-2.5">
              <StatusBadge status={r.status as DisplayStatus} />
              <span className="text-xs text-muted-2 tabular">
                {r.count} {r.count === 1 ? "invoice" : "invoices"}
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground tabular">
              {formatMoney(r.total, currency)}
            </span>
          </li>
        ))}
    </ul>
  );
}

function TopCustomers({
  rows,
  currency,
}: {
  rows: ReportSummary["byCustomer"];
  currency: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-muted">
        No customer activity in this range.
      </p>
    );
  }
  return (
    <Table>
      <THead>
        <TR>
          <TH className="pl-5">Customer</TH>
          <TH className="text-right">Billed</TH>
          <TH className="text-right">Collected</TH>
          <TH className="pr-5 text-right">Outstanding</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((c) => (
          <TR key={c.customerId}>
            <TD className="max-w-[16rem] truncate pl-5 font-medium">
              {c.name}
            </TD>
            <TD className="text-right tabular">
              {formatMoney(c.billed, currency)}
            </TD>
            <TD className="text-right tabular">
              {formatMoney(c.collected, currency)}
            </TD>
            <TD className="pr-5 text-right tabular">
              {c.outstanding > 0 ? (
                <span className="font-medium text-foreground">
                  {formatMoney(c.outstanding, currency)}
                </span>
              ) : (
                <span className="text-muted-2">
                  {formatMoney(0, currency)}
                </span>
              )}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading reports">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-4 h-3 w-40" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-64 w-full" />
      </Card>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-4 h-40 w-full" />
        </Card>
        <Card className="p-5 lg:col-span-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-40 w-full" />
        </Card>
      </div>
    </div>
  );
}
