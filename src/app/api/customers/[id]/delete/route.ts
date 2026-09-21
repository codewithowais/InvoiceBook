import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, invoices } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.id, id),
        eq(customers.businessId, user.businessId),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);
  if (!customer) return fail("Customer not found", 404);

  // Block deletion when the customer still has non-void invoices.
  const [{ blocking }] = await db
    .select({ blocking: sql<string>`count(*)` })
    .from(invoices)
    .where(
      and(
        eq(invoices.customerId, id),
        eq(invoices.businessId, user.businessId),
        isNull(invoices.deletedAt),
        ne(invoices.status, "void"),
      ),
    );

  if (Number(blocking) > 0) {
    return fail(
      "Cannot delete a customer with active invoices. Void or delete them first.",
      409,
    );
  }

  const [updated] = await db
    .update(customers)
    .set({ deletedAt: new Date(), updatedBy: user.id, updatedAt: new Date() })
    .where(
      and(eq(customers.id, id), eq(customers.businessId, user.businessId)),
    )
    .returning();

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "customer.delete",
    entityType: "customer",
    entityId: id,
    metadata: { name: customer.name, email: customer.email },
  });

  return ok(updated);
});
