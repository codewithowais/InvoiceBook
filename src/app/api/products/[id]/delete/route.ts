import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const [product] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, id),
        eq(products.businessId, user.businessId),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);
  if (!product) return fail("Product not found", 404);

  // Soft delete only. Line items are copied from products (never FK-linked),
  // so archiving/deleting a product never affects past invoices.
  const [updated] = await db
    .update(products)
    .set({ deletedAt: new Date(), updatedBy: user.id, updatedAt: new Date() })
    .where(
      and(eq(products.id, id), eq(products.businessId, user.businessId)),
    )
    .returning();

  return ok(updated);
});
