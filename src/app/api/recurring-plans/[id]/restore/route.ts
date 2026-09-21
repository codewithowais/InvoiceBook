import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { recurringPlans } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/recurring-plans/[id]/restore — admin only.
 * Flips a soft-deleted recurring plan back to active (deletedAt = null),
 * strictly scoped to the caller's business (IDOR guard).
 *
 * Note: the ActivityAction union has no `recurring.restore`, so — per the build
 * brief — this restore is intentionally not written to the audit log rather
 * than force an ill-fitting action onto it.
 */
export const PATCH = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireAdmin();
  const { id } = await ctx.params;

  const [plan] = await db
    .select({ id: recurringPlans.id })
    .from(recurringPlans)
    .where(
      and(
        eq(recurringPlans.id, id),
        eq(recurringPlans.businessId, user.businessId),
        isNotNull(recurringPlans.deletedAt),
      ),
    )
    .limit(1);
  if (!plan) return fail("Recurring plan not found in trash", 404);

  const [updated] = await db
    .update(recurringPlans)
    .set({ deletedAt: null, updatedBy: user.id, updatedAt: new Date() })
    .where(
      and(
        eq(recurringPlans.id, id),
        eq(recurringPlans.businessId, user.businessId),
      ),
    )
    .returning();

  return ok(updated);
});
