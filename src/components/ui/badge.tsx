import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/format";
import type { InvoiceStatus } from "@/db/schema";

/** Derived status used only for display (adds "overdue"). */
export type DisplayStatus = InvoiceStatus | "overdue";

type Variant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

const variants: Record<Variant, string> = {
  neutral:
    "bg-surface-3 text-muted ring-1 ring-inset ring-border-strong/60",
  primary: "bg-primary-soft text-primary-soft-fg ring-1 ring-inset ring-primary/20",
  success: "bg-success-soft text-success ring-1 ring-inset ring-success/25",
  warning: "bg-warning-soft text-warning ring-1 ring-inset ring-warning/25",
  danger: "bg-danger-soft text-danger ring-1 ring-inset ring-danger/25",
  info: "bg-[var(--status-partial-bg)] text-[var(--status-partial-fg)] ring-1 ring-inset ring-[var(--status-partial-ring)]",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

const STATUS_STYLES: Record<DisplayStatus, string> = {
  draft:
    "bg-[var(--status-draft-bg)] text-[var(--status-draft-fg)] ring-[var(--status-draft-ring)]",
  unpaid:
    "bg-[var(--status-unpaid-bg)] text-[var(--status-unpaid-fg)] ring-[var(--status-unpaid-ring)]",
  partially_paid:
    "bg-[var(--status-partial-bg)] text-[var(--status-partial-fg)] ring-[var(--status-partial-ring)]",
  paid: "bg-[var(--status-paid-bg)] text-[var(--status-paid-fg)] ring-[var(--status-paid-ring)]",
  overdue:
    "bg-[var(--status-overdue-bg)] text-[var(--status-overdue-fg)] ring-[var(--status-overdue-ring)]",
  void: "bg-[var(--status-void-bg)] text-[var(--status-void-fg)] ring-[var(--status-void-ring)]",
};

const DOT_COLOR: Record<DisplayStatus, string> = {
  draft: "var(--status-draft-fg)",
  unpaid: "var(--status-unpaid-fg)",
  partially_paid: "var(--status-partial-fg)",
  paid: "var(--status-paid-fg)",
  overdue: "var(--status-overdue-fg)",
  void: "var(--status-void-fg)",
};

export function StatusBadge({
  status,
  className,
  withDot = true,
}: {
  status: DisplayStatus;
  className?: string;
  withDot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        STATUS_STYLES[status],
        className,
      )}
    >
      {withDot ? (
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: DOT_COLOR[status] }}
        />
      ) : null}
      {statusLabel(status)}
    </span>
  );
}
