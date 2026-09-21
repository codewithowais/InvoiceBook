import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/customers/[id]/restore — admin only.
 * Flips a soft-deleted customer back to active (deletedAt = null), strictly
 * scoped to the caller's business (IDOR guard).
 */
export const PATCH = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireAdmin();
  const { id } = await ctx.params;

  const [customer] = await db
    .select({ id: customers.id, name: customers.name, email: customers.email })
    .from(customers)
    .where(
      and(
        eq(customers.id, id),
        eq(customers.businessId, user.businessId),
        isNotNull(customers.deletedAt),
      ),
    )
    .limit(1);
  if (!customer) return fail("Customer not found in trash", 404);

  const [updated] = await db
    .update(customers)
    .set({ deletedAt: null, updatedBy: user.id, updatedAt: new Date() })
    .where(
      and(eq(customers.id, id), eq(customers.businessId, user.businessId)),
    )
    .returning();

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "customer.restore",
    entityType: "customer",
    entityId: id,
    metadata: { name: customer.name, email: customer.email },
  });

  return ok(updated);
});
