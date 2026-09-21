import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { recurringPlans } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireAdmin();
  const { id } = await ctx.params;

  const [plan] = await db
    .select()
    .from(recurringPlans)
    .where(
      and(
        eq(recurringPlans.id, id),
        eq(recurringPlans.businessId, user.businessId),
        isNull(recurringPlans.deletedAt),
      ),
    )
    .limit(1);
  if (!plan) return fail("Recurring plan not found", 404);
  if (plan.status === "ended") {
    return fail("Cannot pause an ended plan", 409);
  }

  const [updated] = await db
    .update(recurringPlans)
    .set({ status: "paused", updatedBy: user.id, updatedAt: new Date() })
    .where(eq(recurringPlans.id, id))
    .returning();

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "recurring.pause",
    entityType: "recurring_plan",
    entityId: id,
    metadata: { customerId: plan.customerId },
  });

  return ok(updated);
});
