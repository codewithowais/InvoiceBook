import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  customers,
  invoiceItems,
  invoices,
  payments,
  recurringPlans,
} from "@/db/schema";
import type { Invoice, RecurringPlan } from "@/db/schema";
import { computeTotals } from "@/lib/money";
import { addMonths, toISODate } from "@/lib/format";
import type { CurrentUser } from "@/lib/session";

/**
 * The exact transaction handle drizzle passes to `db.transaction((tx) => ...)`.
 * Everything below accepts `Tx` so it can also run against the top-level `db`
 * when a caller wants a single implicit statement.
 */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Snapshot shapes we freeze onto an invoice at finalize time. */
export type CustomerSnapshot = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  billingAddress: string | null;
};

export type BusinessSnapshot = {
  id: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  logoUrl: string | null;
  bankDetails: string | null;
};

/**
 * Atomically increments `businesses.invoiceSeq` and returns the formatted
 * invoice number `${prefix}-${padded seq}`. Uses UPDATE ... RETURNING so two
 * concurrent finalizes can never claim the same number.
 */
export async function nextInvoiceNumber(
  tx: Tx,
  businessId: string,
): Promise<string> {
  const [row] = await tx
    .update(businesses)
    .set({
      invoiceSeq: sql`${businesses.invoiceSeq} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, businessId))
    .returning({
      seq: businesses.invoiceSeq,
      prefix: businesses.invoicePrefix,
    });

  if (!row) throw new Error("Business not found while assigning invoice number");
  return `${row.prefix}-${String(row.seq).padStart(4, "0")}`;
}

function buildCustomerSnapshot(c: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  billingAddress: string | null;
}): CustomerSnapshot {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    billingAddress: c.billingAddress,
  };
}

function buildBusinessSnapshot(b: {
  id: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  logoUrl: string | null;
  bankDetails: string | null;
}): BusinessSnapshot {
  return {
    id: b.id,
    name: b.name,
    addressLine1: b.addressLine1,
    addressLine2: b.addressLine2,
    city: b.city,
    state: b.state,
    postalCode: b.postalCode,
    country: b.country,
    logoUrl: b.logoUrl,
    bankDetails: b.bankDetails,
  };
}

/**
 * Promote a draft invoice: assign its number, set status `unpaid`, stamp
 * `finalizedAt`, and freeze customer + business snapshots. Only allowed from
 * status `draft`. Must run inside a transaction.
 */
export async function finalizeInvoice(
  tx: Tx,
  invoiceId: string,
  user: CurrentUser,
): Promise<Invoice> {
  const [inv] = await tx
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!inv) throw new Error("Invoice not found");
  if (inv.businessId !== user.businessId) throw new Error("Forbidden");
  if (inv.status !== "draft") {
    throw new Error("Only draft invoices can be finalized");
  }

  const [customer] = await tx
    .select()
    .from(customers)
    .where(eq(customers.id, inv.customerId))
    .limit(1);
  if (!customer) throw new Error("Customer not found");

  const [business] = await tx
    .select()
    .from(businesses)
    .where(eq(businesses.id, inv.businessId))
    .limit(1);
  if (!business) throw new Error("Business not found");

  const number = await nextInvoiceNumber(tx, inv.businessId);

  const [updated] = await tx
    .update(invoices)
    .set({
      number,
      status: "unpaid",
      finalizedAt: new Date(),
      customerSnapshot: buildCustomerSnapshot(customer),
      businessSnapshot: buildBusinessSnapshot(business),
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  return updated;
}

/**
 * Recompute `amountPaid` = sum of active payments, and derive status:
 *  - paid           when amountPaid >= total
 *  - partially_paid when 0 < amountPaid < total
 *  - unpaid         otherwise
 * A `void` invoice is never downgraded/changed by payments.
 */
export async function recalcInvoiceStatus(
  tx: Tx,
  invoiceId: string,
): Promise<Invoice> {
  const [inv] = await tx
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!inv) throw new Error("Invoice not found");

  const [agg] = await tx
    .select({
      paid: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(
      and(eq(payments.invoiceId, invoiceId), eq(payments.status, "active")),
    );

  const amountPaid = Number(agg?.paid ?? 0);

  // Never mutate a voided invoice's status.
  if (inv.status === "void") {
    const [updated] = await tx
      .update(invoices)
      .set({ amountPaid, updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
      .returning();
    return updated;
  }

  let status: Invoice["status"];
  if (amountPaid >= inv.total) status = "paid";
  else if (amountPaid > 0) status = "partially_paid";
  else status = "unpaid";

  const [updated] = await tx
    .update(invoices)
    .set({ amountPaid, status, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId))
    .returning();
  return updated;
}

/**
 * Create a finalized, unpaid invoice from a recurring plan template.
 * Totals are recomputed with `computeTotals` (plans carry no discount).
 * Issue date defaults to the plan's `nextRunDate` (else today); due = +30 days.
 * Must run inside a transaction.
 */
export async function generateInvoiceFromPlan(
  tx: Tx,
  plan: RecurringPlan,
  // `user` is accepted for interface parity; generated invoices are attributed
  // to the plan's author (`plan.createdBy`) so the FK is always valid, even
  // when the cron (no real session) triggers generation.
  _user: CurrentUser,
  // Optional issue-date override for a manual "generate for month X"; the cron
  // and default flow use the plan's scheduled `nextRunDate`.
  issueDateOverride?: string | null,
): Promise<Invoice> {
  const [customer] = await tx
    .select()
    .from(customers)
    .where(eq(customers.id, plan.customerId))
    .limit(1);
  if (!customer) throw new Error("Customer not found for plan");

  const [business] = await tx
    .select()
    .from(businesses)
    .where(eq(businesses.id, plan.businessId))
    .limit(1);
  if (!business) throw new Error("Business not found for plan");

  const items = plan.items.map((it) => ({
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    taxRateBps: it.taxRateBps,
  }));

  const totals = computeTotals({
    items,
    discountType: "none",
    discountValue: 0,
  });

  const issueDate = issueDateOverride || plan.nextRunDate || toISODate(new Date());
  const dueDateObj = new Date(issueDate);
  dueDateObj.setDate(dueDateObj.getDate() + 30);
  const dueDate = toISODate(dueDateObj);

  const number = await nextInvoiceNumber(tx, plan.businessId);

  const [invoice] = await tx
    .insert(invoices)
    .values({
      businessId: plan.businessId,
      customerId: plan.customerId,
      recurringPlanId: plan.id,
      number,
      status: "unpaid",
      currency: plan.currency,
      issueDate,
      dueDate,
      subtotal: totals.subtotal,
      discountType: "none",
      discountValue: 0,
      taxTotal: totals.taxTotal,
      total: totals.total,
      amountPaid: 0,
      notes: plan.notes,
      terms: plan.terms,
      customerSnapshot: buildCustomerSnapshot(customer),
      businessSnapshot: buildBusinessSnapshot(business),
      finalizedAt: new Date(),
      createdBy: plan.createdBy,
      updatedBy: plan.createdBy,
    })
    .returning();

  await tx.insert(invoiceItems).values(
    plan.items.map((it, i) => {
      const line = totals.lines[i];
      return {
        invoiceId: invoice.id,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRateBps: it.taxRateBps,
        lineSubtotal: line.lineSubtotal,
        lineTax: line.lineTax,
        lineTotal: line.lineTotal,
        sortOrder: i,
      };
    }),
  );

  return invoice;
}

/**
 * Run a single plan cycle inside `tx`: generate the invoice, then advance the
 * plan's counters. `nextRunDate` only moves forward after a successful create,
 * which keeps the routine idempotent per transaction.
 */
export async function runPlanCycle(
  tx: Tx,
  plan: RecurringPlan,
  user: CurrentUser,
  issueDateOverride?: string | null,
): Promise<Invoice> {
  const invoice = await generateInvoiceFromPlan(tx, plan, user, issueDateOverride);

  const cyclesRun = plan.cyclesRun + 1;
  const prev = new Date(plan.nextRunDate);
  const next = addMonths(prev, 1);
  const nextRunDate = toISODate(next);

  let ended = false;
  if (plan.maxCycles != null && cyclesRun >= plan.maxCycles) ended = true;
  if (plan.endDate && new Date(nextRunDate) > new Date(plan.endDate)) {
    ended = true;
  }

  await tx
    .update(recurringPlans)
    .set({
      cyclesRun,
      lastRunDate: plan.nextRunDate,
      nextRunDate,
      status: ended ? "ended" : "active",
      updatedAt: new Date(),
    })
    .where(eq(recurringPlans.id, plan.id));

  return invoice;
}

export type CreatedInvoiceRef = {
  invoiceId: string;
  businessId: string;
  number: string | null;
  autoEmail: boolean;
};

export type RunResult = {
  count: number;
  invoiceNumbers: string[];
  created: CreatedInvoiceRef[];
};

/**
 * Find every active plan whose `nextRunDate <= asOf` and generate its next
 * invoice. Each plan runs in its own transaction so one failure cannot roll
 * back the others. Returns the count and the created invoice numbers.
 */
export async function runDueRecurringPlans(asOf: Date): Promise<RunResult> {
  const cutoff = toISODate(asOf);

  const duePlans = await db
    .select()
    .from(recurringPlans)
    .where(
      and(
        eq(recurringPlans.status, "active"),
        sql`${recurringPlans.deletedAt} is null`,
        sql`${recurringPlans.nextRunDate} <= ${cutoff}`,
      ),
    );

  const invoiceNumbers: string[] = [];
  const created: CreatedInvoiceRef[] = [];

  for (const plan of duePlans) {
    // A synthetic actor for the shared routine's signature. Actual DB
    // attribution uses `plan.createdBy` inside `generateInvoiceFromPlan`.
    const actor: CurrentUser = {
      id: plan.createdBy ?? "system",
      name: "Recurring",
      email: "",
      role: "admin",
      businessId: plan.businessId,
      isActive: true,
    };

    const invoice = await db.transaction((tx) => runPlanCycle(tx, plan, actor));
    if (invoice.number) invoiceNumbers.push(invoice.number);
    created.push({
      invoiceId: invoice.id,
      businessId: invoice.businessId,
      number: invoice.number,
      autoEmail: plan.autoEmail,
    });
  }

  return { count: invoiceNumbers.length, invoiceNumbers, created };
}
