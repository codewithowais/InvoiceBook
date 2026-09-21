"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CircleDollarSign,
  Clock,
  FilePlus2,
  FileText,
  Repeat,
  Settings,
  TriangleAlert,
  UserPlus,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiGet } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import type { DashboardSummary } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { toDisplayStatus } from "@/lib/invoice-ui";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { data, loading, error, refetch } = useAsync<DashboardSummary>(
    () => apiGet<DashboardSummary>("/api/dashboard"),
    [],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="A live snapshot of what you're owed and what's been collected."
        actions={
          <ButtonLink href="/invoices/new">
            <FilePlus2 className="size-4" aria-hidden />
            New invoice
          </ButtonLink>
        }
      />

      {error ? (
        <Card>
          <ErrorState
            description="We couldn't load your dashboard summary."
            onRetry={refetch}
          />
        </Card>
      ) : (
        <DashboardBody data={data} loading={loading} />
      )}
    </div>
  );
}

function DashboardBody({
  data,
  loading,
}: {
  data: DashboardSummary | null;
  loading: boolean;
}) {
  const currency = data?.currency ?? "USD";
  const isFirstRun =
    !loading &&
    data != null &&
    data.customerCount === 0 &&
    data.invoiceCount === 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Outstanding"
          icon={Wallet}
          tone="primary"
          loading={loading}
          value={data ? formatMoney(data.totalOutstanding, currency) : ""}
          hint="Across all unpaid & partial invoices"
        />
        <StatCard
          label="Paid this month"
          icon={CircleDollarSign}
          tone="success"
          loading={loading}
          value={data ? formatMoney(data.paidThisMonth, currency) : ""}
          hint="Payments received this calendar month"
        />
        <StatCard
          label="Overdue"
          icon={TriangleAlert}
          tone="danger"
          loading={loading}
          value={data ? String(data.overdueCount) : ""}
          hint={data?.overdueCount ? "Needs attention" : "Nothing overdue"}
        />
        <StatCard
          label="Drafts"
          icon={Clock}
          tone="neutral"
          loading={loading}
          value={data ? String(data.draftCount) : ""}
          hint="Unfinalized invoices"
        />
      </div>

      {isFirstRun ? (
        <OnboardingChecklist hasCustomers={false} hasInvoices={false} />
      ) : null}

      <RecentInvoices
        loading={loading}
        invoices={data?.recentInvoices ?? []}
        showChecklist={
          !loading &&
          data != null &&
          !isFirstRun &&
          (data.customerCount === 0 || data.invoiceCount === 0)
        }
        hasCustomers={(data?.customerCount ?? 0) > 0}
        hasInvoices={(data?.invoiceCount ?? 0) > 0}
      />
    </div>
  );
}

const TONE_STYLES: Record<
  string,
  { wrap: string; icon: string }
> = {
  primary: { wrap: "bg-primary-soft text-primary-soft-fg", icon: "text-primary" },
  success: { wrap: "bg-success-soft text-success", icon: "text-success" },
  danger: { wrap: "bg-danger-soft text-danger", icon: "text-danger" },
  neutral: { wrap: "bg-surface-3 text-muted", icon: "text-muted-2" },
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: keyof typeof TONE_STYLES;
  loading: boolean;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-muted">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-28" />
          ) : (
            <p className="mt-1.5 font-display text-[1.75rem] font-semibold leading-none tracking-tight text-foreground tabular">
              {value}
            </p>
          )}
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

function RecentInvoices({
  invoices,
  loading,
  showChecklist,
  hasCustomers,
  hasInvoices,
}: {
  invoices: DashboardSummary["recentInvoices"];
  loading: boolean;
  showChecklist: boolean;
  hasCustomers: boolean;
  hasInvoices: boolean;
}) {
  const router = useRouter();
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className={cn("overflow-hidden", showChecklist ? "lg:col-span-2" : "lg:col-span-3")}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[0.9375rem] font-semibold text-foreground">
            Recent invoices
          </h2>
          <Link
            href="/invoices"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover"
          >
            View all
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Create your first invoice to start tracking what you're owed."
            action={
              <ButtonLink href="/invoices/new">
                <FilePlus2 className="size-4" aria-hidden />
                New invoice
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {invoices.map((inv) => {
              const display = toDisplayStatus(inv.status, inv.dueDate);
              return (
                <li key={inv.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/invoices/${inv.id}`)}
                    className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {inv.customerName}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-2">
                        {inv.number ?? "Draft"} · Due {formatDate(inv.dueDate)}
                      </p>
                    </div>
                    <StatusBadge status={display} />
                    <div className="w-24 shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground tabular">
                        {formatMoney(inv.total, inv.currency)}
                      </p>
                      {inv.outstanding > 0 && inv.status !== "draft" ? (
                        <p className="text-xs text-muted-2 tabular">
                          {formatMoney(inv.outstanding, inv.currency)} due
                        </p>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {showChecklist ? (
        <OnboardingChecklist
          hasCustomers={hasCustomers}
          hasInvoices={hasInvoices}
          compact
        />
      ) : null}
    </div>
  );
}

function OnboardingChecklist({
  hasCustomers,
  hasInvoices,
  compact,
}: {
  hasCustomers: boolean;
  hasInvoices: boolean;
  compact?: boolean;
}) {
  const steps: {
    done: boolean;
    title: string;
    description: string;
    href: string;
    cta: string;
    icon: LucideIcon;
  }[] = [
    {
      done: true,
      title: "Create your account",
      description: "Your workspace is ready to go.",
      href: "/settings",
      cta: "Done",
      icon: Settings,
    },
    {
      done: false,
      title: "Set up your business",
      description: "Add your name, address, currency and invoice prefix.",
      href: "/settings",
      cta: "Open settings",
      icon: Settings,
    },
    {
      done: hasCustomers,
      title: "Add your first customer",
      description: "You'll bill invoices to them.",
      href: "/customers",
      cta: "Add customer",
      icon: UserPlus,
    },
    {
      done: hasInvoices,
      title: "Create your first invoice",
      description: "Add line items and finalize when ready.",
      href: "/invoices/new",
      cta: "New invoice",
      icon: FilePlus2,
    },
  ];
  const completed = steps.filter((s) => s.done).length;

  return (
    <Card className={cn(compact ? "" : "", "overflow-hidden")}>
      <div className="border-b border-border bg-primary-soft/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <Repeat className="size-4 text-primary" aria-hidden />
          <h2 className="text-[0.9375rem] font-semibold text-foreground">
            Get set up
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted">
          {completed} of {steps.length} steps complete
        </p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>
      </div>
      <ul className="divide-y divide-border">
        {steps.map((step) => (
          <li key={step.title} className="flex items-start gap-3 px-5 py-3.5">
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1 ring-inset",
                step.done
                  ? "bg-success-soft text-success ring-success/25"
                  : "bg-surface-3 text-muted-2 ring-border-strong",
              )}
            >
              {step.done ? "✓" : ""}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.done ? "text-muted line-through" : "text-foreground",
                )}
              >
                {step.title}
              </p>
              {!step.done ? (
                <p className="mt-0.5 text-xs text-muted-2">
                  {step.description}
                </p>
              ) : null}
            </div>
            {!step.done ? (
              <Link
                href={step.href}
                className="shrink-0 text-xs font-medium text-primary hover:text-primary-hover"
              >
                {step.cta}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
