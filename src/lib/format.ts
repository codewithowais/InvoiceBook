/** Shared, framework-agnostic formatting helpers (safe on client & server). */

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** yyyy-mm-dd for <input type="date"> and API bodies. */
export function toISODate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toISOString().slice(0, 10);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(targetMonth);
  // Clamp to last day of the target month (e.g. Jan 31 -> Feb 28).
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetDay, lastDay));
  return d;
}

export function isOverdue(dueDate: string, status: string): boolean {
  if (status !== "unpaid" && status !== "partially_paid") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  unpaid: "Unpaid",
  partially_paid: "Partially Paid",
  paid: "Paid",
  void: "Void",
  overdue: "Overdue",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
