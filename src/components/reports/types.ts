/**
 * DTOs for the Admin Reporting feature (Phase 2, User Story 3).
 * These mirror the JSON shape returned by GET /api/reports and are owned by
 * the reports feature (kept out of the frozen src/lib/types.ts).
 */
import type { InvoiceStatus } from "@/lib/types";

export type ReportMonth = {
  /** "YYYY-MM" */
  month: string;
  billed: number; // minor units
  collected: number; // minor units
};

export type ReportStatusRow = {
  /** Stored invoice status, plus the derived "overdue" bucket. */
  status: InvoiceStatus | "overdue";
  count: number;
  total: number; // minor units
};

export type ReportCustomerRow = {
  customerId: string;
  name: string;
  billed: number; // minor units
  collected: number; // minor units
  outstanding: number; // minor units
};

export type ReportSummary = {
  range: { from: string; to: string };
  totals: {
    billed: number;
    collected: number;
    outstanding: number;
    currency: string;
  };
  monthly: ReportMonth[];
  byStatus: ReportStatusRow[];
  byCustomer: ReportCustomerRow[];
};

/** Date-range presets offered in the UI. */
export type RangePreset =
  | "this_month"
  | "last_3_months"
  | "this_year"
  | "last_12_months"
  | "custom";
