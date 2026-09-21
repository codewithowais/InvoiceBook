import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { customers, recurringPlans } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { recurringPlanUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function loadPlan(id: string, businessId: string) {
  const [row] = await db
    .select()
    .from(recurringPlans)
    .where(
      and(
        eq(recurringPlans.id, id),
        eq(recurringPlans.businessId, businessId),
        isNull(recurringPlans.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const plan = await loadPlan(id, user.businessId);
  if (!plan) return fail("Recurring plan not found", 404);
  return ok(plan);
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireAdmin();
  const { id } = await ctx.params;

  const plan = await loadPlan(id, user.businessId);
  if (!plan) return fail("Recurring plan not found", 404);

  const body = recurringPlanUpdateSchema.parse(await req.json());

  if (body.customerId && body.customerId !== plan.customerId) {
    const [c] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.id, body.customerId),
          eq(customers.businessId, user.businessId),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);
    if (!c) return fail("Customer not found", 404);
  }

  const [updated] = await db
    .update(recurringPlans)
    .set({
      ...(body.customerId ? { customerId: body.customerId } : {}),
      ...(body.startDate ? { startDate: body.startDate } : {}),
      ...(body.endDate !== undefined ? { endDate: body.endDate ?? null } : {}),
      ...(body.maxCycles !== undefined
        ? { maxCycles: body.maxCycles ?? null }
        : {}),
      ...(body.autoEmail !== undefined ? { autoEmail: body.autoEmail } : {}),
      ...(body.currency ? { currency: body.currency } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      ...(body.terms !== undefined ? { terms: body.terms ?? null } : {}),
      ...(body.items ? { items: body.items } : {}),
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(recurringPlans.id, id))
    .returning();

  return ok(updated);
});
