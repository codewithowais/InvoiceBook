/**
 * DTOs for the admin Activity page (audit log + trash). These mirror the
 * `/api/activity` and `/api/trash` response payloads. Kept here (not in the
 * frozen src/lib/types.ts) per the build brief.
 */

export type ActivityEntityType =
  | "invoice"
  | "payment"
  | "customer"
  | "recurring_plan"
  | "team"
  | "business";

export type ActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
};

export type ActivityFeed = {
  items: ActivityItem[];
  page: number;
  hasMore: boolean;
};

export type TrashType = "invoice" | "customer" | "recurring_plan";

export type TrashItem = {
  id: string;
  type: TrashType;
  label: string;
  sublabel: string | null;
  currency: string | null;
  amount: number | null;
  deletedAt: string;
  purgeAt: string;
};

export type TrashList = {
  items: TrashItem[];
  retentionDays: number;
};

/** Humanized "<actor> <verb>" labels, keyed by ActivityAction. */
const ACTION_LABELS: Record<string, string> = {
  "business.create": "created the workspace",
  "invoice.create": "created an invoice",
  "invoice.finalize": "finalized an invoice",
  "invoice.send": "emailed an invoice",
  "invoice.delete": "deleted an invoice",
  "invoice.restore": "restored an invoice",
  "payment.record": "recorded a payment",
  "payment.void": "voided a payment",
  "customer.create": "added a customer",
  "customer.delete": "deleted a customer",
  "customer.restore": "restored a customer",
  "recurring.create": "created a recurring plan",
  "recurring.pause": "paused a recurring plan",
  "recurring.resume": "resumed a recurring plan",
  "recurring.generate": "generated an invoice from a recurring plan",
  "team.invite": "invited a teammate",
  "team.update": "updated a team member",
  "settings.update": "updated settings",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

/** Filter options for the action dropdown (value + human label). */
export const ACTION_FILTER_OPTIONS: { value: string; label: string }[] =
  Object.entries(ACTION_LABELS).map(([value, label]) => ({
    value,
    // Capitalize the verb phrase for the dropdown.
    label: label.charAt(0).toUpperCase() + label.slice(1),
  }));

export const ENTITY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "invoice", label: "Invoices" },
  { value: "payment", label: "Payments" },
  { value: "customer", label: "Customers" },
  { value: "recurring_plan", label: "Recurring plans" },
  { value: "team", label: "Team" },
  { value: "business", label: "Business" },
];

const TRASH_TYPE_LABELS: Record<TrashType, string> = {
  invoice: "Invoice",
  customer: "Customer",
  recurring_plan: "Recurring plan",
};

export function trashTypeLabel(type: TrashType): string {
  return TRASH_TYPE_LABELS[type] ?? type;
}

/** A compact, absolute+relative timestamp. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk} wk${wk === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  const yr = Math.round(day / 365);
  return `${yr} yr${yr === 1 ? "" : "s"} ago`;
}

/** Full absolute timestamp for a `title`/tooltip. */
export function absoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Days remaining until a trash item is purged (0 = due now/overdue). */
export function daysUntil(iso: string): number {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000)));
}
