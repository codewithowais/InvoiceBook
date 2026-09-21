import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { customers, recurringPlans } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { recurringPlanSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const user = await requireUser();

  const rows = await db
    .select({
      id: recurringPlans.id,
      customerId: recurringPlans.customerId,
      customerName: customers.name,
      status: recurringPlans.status,
      cycle: recurringPlans.cycle,
      startDate: recurringPlans.startDate,
      endDate: recurringPlans.endDate,
      maxCycles: recurringPlans.maxCycles,
      cyclesRun: recurringPlans.cyclesRun,
      nextRunDate: recurringPlans.nextRunDate,
      lastRunDate: recurringPlans.lastRunDate,
      currency: recurringPlans.currency,
      createdAt: recurringPlans.createdAt,
    })
    .from(recurringPlans)
    .innerJoin(customers, eq(recurringPlans.customerId, customers.id))
    .where(
      and(
        eq(recurringPlans.businessId, user.businessId),
        isNull(recurringPlans.deletedAt),
      ),
    )
    .orderBy(desc(recurringPlans.createdAt));

  return ok({ plans: rows });
});

export const POST = handler(async (req: Request) => {
  const user = await requireAdmin();
  const body = recurringPlanSchema.parse(await req.json());

  // Verify the customer belongs to this business (prevent IDOR).
  const [customer] = await db
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
  if (!customer) return fail("Customer not found", 404);

  const [created] = await db
    .insert(recurringPlans)
    .values({
      businessId: user.businessId,
      customerId: body.customerId,
      status: "active",
      cycle: "monthly",
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      maxCycles: body.maxCycles ?? null,
      cyclesRun: 0,
      nextRunDate: body.startDate,
      autoEmail: body.autoEmail,
      currency: body.currency,
      notes: body.notes ?? null,
      terms: body.terms ?? null,
      items: body.items,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "recurring.create",
    entityType: "recurring_plan",
    entityId: created.id,
    metadata: { customerId: created.customerId, currency: created.currency },
  });

  return ok(created, 201);
});
