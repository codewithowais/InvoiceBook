import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices, payments } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (_req: Request, ctx: Ctx) => {
  // Admin only.
  const user = await requireAdmin();
  const { id } = await ctx.params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, id),
        eq(invoices.businessId, user.businessId),
        isNull(invoices.deletedAt),
      ),
    )
    .limit(1);
  if (!invoice) return fail("Invoice not found", 404);

  // Drafts can be deleted anytime; finalized invoices only when they have no
  // active payments.
  if (invoice.status !== "draft") {
    const [{ activePayments }] = await db
      .select({ activePayments: sql<string>`count(*)` })
      .from(payments)
      .where(
        and(eq(payments.invoiceId, id), eq(payments.status, "active")),
      );
    if (Number(activePayments) > 0) {
      return fail(
        "Cannot delete an invoice with active payments. Void them first.",
        409,
      );
    }
  }

  const [updated] = await db
    .update(invoices)
    .set({ deletedAt: new Date(), updatedBy: user.id, updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "invoice.delete",
    entityType: "invoice",
    entityId: id,
    metadata: { number: invoice.number, total: invoice.total },
  });

  return ok(updated);
});
