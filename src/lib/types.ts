/**
 * Frontend API DTOs — the shapes the UI expects back from the JSON endpoints
 * described in docs/BACKEND.md. The backend is built in parallel, so these
 * are the frontend's contract-of-record; optional fields are used where the
 * exact server shape is not guaranteed. (New file, frontend-owned.)
 */
import type {
  Business,
  Customer,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  Payment,
  Product,
  RecurringPlan,
} from "@/db/schema";

export type { Business, Customer, Invoice, InvoiceItem, Payment, Product, RecurringPlan };
export type { InvoiceStatus };

export type DiscountType = "none" | "flat" | "percent";
export type PaymentMethod =
  | "bank_transfer"
  | "cash"
  | "cheque"
  | "card_offline"
  | "other";

/* ------------------------------- Dashboard ------------------------------- */

export type DashboardSummary = {
  totalOutstanding: number; // minor units
  paidThisMonth: number; // minor units
  overdueCount: number;
  draftCount: number;
  currency: string;
  customerCount: number;
  invoiceCount: number;
  recentInvoices: InvoiceListItem[];
};

/* ------------------------------- Customers ------------------------------- */

export type CustomerListItem = Customer & {
  outstanding: number; // minor units
  totalBilled?: number;
  lastInvoiceDate: string | null;
  invoiceCount?: number;
};

export type CustomerDetail = {
  customer: Customer;
  invoices: InvoiceListItem[];
  totals: {
    billed: number;
    paid: number;
    outstanding: number;
  };
};

/* ------------------------------- Invoices -------------------------------- */

export type InvoiceListItem = {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  currency: string;
  issueDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  outstanding: number;
  customerId: string;
  customerName: string;
  finalizedAt?: string | null;
};

export type PaymentWithProof = Payment & {
  /** short-lived signed URL for the private proof blob, if available */
  proofUrl?: string | null;
};

export type InvoiceDetail = {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: PaymentWithProof[];
  customer: Customer | null;
  business?: Business | null;
  outstanding: number;
  /** Audit trail (Phase 2): names behind createdBy / updatedBy. */
  createdByName?: string | null;
  updatedByName?: string | null;
};

/* --------------------------------- Team ---------------------------------- */

export type TeamRole = "admin" | "staff";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  isActive: boolean;
  createdAt: string;
};

export type PendingInvite = {
  id: string;
  email: string;
  role: TeamRole;
  expiresAt: string;
};

export type TeamOverview = {
  members: TeamMember[];
  invites: PendingInvite[];
};

/** Response from POST /api/team/invite. */
export type CreatedInvite = {
  id: string;
  email: string;
  role: TeamRole;
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  inviteUrl: string;
};

/** Response from GET /api/team/invite/[token] (public accept page). */
export type InviteLookup =
  | { valid: false }
  | { valid: true; email: string; role: TeamRole; businessName: string };

/* ---------------------------- Recurring plans ---------------------------- */

export type RecurringPlanListItem = RecurringPlan & {
  customerName: string;
};

export type RecurringPlanDetail = {
  plan: RecurringPlan;
  customer: Customer | null;
  generatedInvoices?: InvoiceListItem[];
};

/* --------------------------- Paginated helpers --------------------------- */

export type Paginated<T> = {
  items: T[];
  total?: number;
  page?: number;
  pageSize?: number;
};
