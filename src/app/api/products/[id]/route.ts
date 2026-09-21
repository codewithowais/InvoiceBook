import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { productUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function loadProduct(id: string, businessId: string) {
  const [row] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, id),
        eq(products.businessId, businessId),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const product = await loadProduct(id, user.businessId);
  if (!product) return fail("Product not found", 404);

  return ok({ product });
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const existing = await loadProduct(id, user.businessId);
  if (!existing) return fail("Product not found", 404);

  const body = productUpdateSchema.parse(await req.json());

  const [updated] = await db
    .update(products)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined
        ? { description: body.description ?? null }
        : {}),
      ...(body.unitPrice !== undefined ? { unitPrice: body.unitPrice } : {}),
      ...(body.taxRateBps !== undefined
        ? { taxRateBps: body.taxRateBps }
        : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(
      and(eq(products.id, id), eq(products.businessId, user.businessId)),
    )
    .returning();

  return ok(updated);
});
