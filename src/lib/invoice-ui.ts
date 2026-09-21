/** Frontend display helpers for invoices & payments (frontend-owned). */
import { isOverdue } from "@/lib/format";
import type { DisplayStatus } from "@/components/ui/badge";
import type { InvoiceStatus, PaymentMethod } from "@/lib/types";

/** Derives the display status, promoting unpaid/partial past-due to "overdue". */
export function toDisplayStatus(
  status: InvoiceStatus,
  dueDate: string,
): DisplayStatus {
  if (isOverdue(dueDate, status)) return "overdue";
  return status;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
  card_offline: "Card (offline)",
  other: "Other",
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = (
  Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]
).map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }));

export const INVOICE_STATUS_FILTERS: {
  value: string;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];
