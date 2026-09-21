import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { customers, invoices, recurringPlans } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok } from "@/lib/api";

export const runtime = "nodejs";

/** Soft-deleted records live in Trash this long before the cron hard-deletes. */
export const TRASH_RETENTION_DAYS = 30;

function purgeDate(deletedAt: Date): string {
  const d = new Date(deletedAt);
  d.setDate(d.getDate() + TRASH_RETENTION_DAYS);
  return d.toISOString();
}

type TrashItem = {
  id: string;
  type: "invoice" | "customer" | "recurring_plan";
  label: string;
  sublabel: string | null;
  currency: string | null;
  amount: number | null;
  deletedAt: string;
  purgeAt: string;
};

/**
 * GET /api/trash — admin only.
 * Lists soft-deleted invoices, customers and recurring plans for the caller's
 * business, each carrying a `type`, `label`, `deletedAt` and a computed
 * `purgeAt` (deletedAt + 30 days). Newest deletions first.
 */
export const GET = handler(async () => {
  const user = await requireAdmin();

  const [deletedInvoices, deletedCustomers, deletedPlans] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        currency: invoices.currency,
        total: invoices.total,
        customerName: customers.name,
        deletedAt: invoices.deletedAt,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .where(
        and(
          eq(invoices.businessId, user.businessId),
          isNotNull(invoices.deletedAt),
        ),
      ),
    db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        deletedAt: customers.deletedAt,
      })
      .from(customers)
      .where(
        and(
          eq(customers.businessId, user.businessId),
          isNotNull(customers.deletedAt),
        ),
      ),
    db
      .select({
        id: recurringPlans.id,
        currency: recurringPlans.currency,
        customerName: customers.name,
        deletedAt: recurringPlans.deletedAt,
      })
      .from(recurringPlans)
      .leftJoin(customers, eq(recurringPlans.customerId, customers.id))
      .where(
        and(
          eq(recurringPlans.businessId, user.businessId),
          isNotNull(recurringPlans.deletedAt),
        ),
      ),
  ]);

  const items: TrashItem[] = [];

  for (const inv of deletedInvoices) {
    if (!inv.deletedAt) continue;
    items.push({
      id: inv.id,
      type: "invoice",
      label: inv.number ?? "Draft invoice",
      sublabel: inv.customerName ?? null,
      currency: inv.currency,
      amount: inv.total,
      deletedAt: inv.deletedAt.toISOString(),
      purgeAt: purgeDate(inv.deletedAt),
    });
  }

  for (const c of deletedCustomers) {
    if (!c.deletedAt) continue;
    items.push({
      id: c.id,
      type: "customer",
      label: c.name,
      sublabel: c.email,
      currency: null,
      amount: null,
      deletedAt: c.deletedAt.toISOString(),
      purgeAt: purgeDate(c.deletedAt),
    });
  }

  for (const p of deletedPlans) {
    if (!p.deletedAt) continue;
    items.push({
      id: p.id,
      type: "recurring_plan",
      label: p.customerName
        ? `Recurring plan — ${p.customerName}`
        : "Recurring plan",
      sublabel: null,
      currency: p.currency,
      amount: null,
      deletedAt: p.deletedAt.toISOString(),
      purgeAt: purgeDate(p.deletedAt),
    });
  }

  items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));

  return ok({ items, retentionDays: TRASH_RETENTION_DAYS });
});
