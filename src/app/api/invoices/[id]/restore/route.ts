import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/invoices/[id]/restore — admin only.
 * Flips a soft-deleted invoice back to active (deletedAt = null), strictly
 * scoped to the caller's business (IDOR guard).
 */
export const PATCH = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireAdmin();
  const { id } = await ctx.params;

  const [invoice] = await db
    .select({ id: invoices.id, number: invoices.number })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, id),
        eq(invoices.businessId, user.businessId),
        isNotNull(invoices.deletedAt),
      ),
    )
    .limit(1);
  if (!invoice) return fail("Invoice not found in trash", 404);

  const [updated] = await db
    .update(invoices)
    .set({ deletedAt: null, updatedBy: user.id, updatedAt: new Date() })
    .where(
      and(eq(invoices.id, id), eq(invoices.businessId, user.businessId)),
    )
    .returning();

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "invoice.restore",
    entityType: "invoice",
    entityId: id,
    metadata: { number: invoice.number },
  });

  return ok(updated);
});
