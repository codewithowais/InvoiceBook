import { and, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, invoices, recurringPlans } from "@/db/schema";
import { handler, ok, fail } from "@/lib/api";
import { env } from "@/env";
import { TRASH_RETENTION_DAYS } from "@/app/api/trash/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/purge-trash — invoked by Vercel Cron (daily at 03:00).
 * Protected by a shared secret, not a user session.
 *
 * HARD-deletes soft-deleted invoices, customers and recurring plans whose
 * deletedAt is older than the retention window. This is the ONLY hard delete
 * in the system.
 *
 * FK-aware ordering: invoices reference customers with no ON DELETE cascade, so
 * invoices (which cascade to their items/payments/reminders) and recurring
 * plans are purged first. Customers are then purged only when no invoice or
 * recurring plan still references them; any still-referenced customer stays in
 * trash until its referencing rows age out too (eventually consistent).
 */
export const GET = handler(async (req: Request) => {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return fail("Unauthorized", 401);
  }

  const cutoff = new Date(
    Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  // 1) Invoices — cascades to invoice_items, payments, invoice_reminders.
  const purgedInvoices = await db
    .delete(invoices)
    .where(and(isNotNull(invoices.deletedAt), lt(invoices.deletedAt, cutoff)))
    .returning({ id: invoices.id });

  // 2) Recurring plans — nothing references them via FK.
  const purgedPlans = await db
    .delete(recurringPlans)
    .where(
      and(
        isNotNull(recurringPlans.deletedAt),
        lt(recurringPlans.deletedAt, cutoff),
      ),
    )
    .returning({ id: recurringPlans.id });

  // 3) Customers — only those no longer referenced by any invoice or plan.
  const purgedCustomers = await db
    .delete(customers)
    .where(
      and(
        isNotNull(customers.deletedAt),
        lt(customers.deletedAt, cutoff),
        sql`not exists (select 1 from ${invoices} where ${invoices.customerId} = ${customers.id})`,
        sql`not exists (select 1 from ${recurringPlans} where ${recurringPlans.customerId} = ${customers.id})`,
      ),
    )
    .returning({ id: customers.id });

  return ok({
    purged: {
      invoices: purgedInvoices.length,
      recurringPlans: purgedPlans.length,
      customers: purgedCustomers.length,
    },
    cutoff: cutoff.toISOString(),
  });
});
