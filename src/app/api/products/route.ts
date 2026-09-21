import { and, asc, desc, eq, ilike, isNull } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok } from "@/lib/api";
import { productCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const activeOnly = url.searchParams.get("activeOnly") === "1";
  const sort = url.searchParams.get("sort") ?? "createdAt";

  const filters = [
    eq(products.businessId, user.businessId),
    isNull(products.deletedAt),
  ];
  if (activeOnly) {
    filters.push(eq(products.isActive, true));
  }
  if (search) {
    filters.push(ilike(products.name, `%${search}%`));
  }

  const orderBy = sort === "name" ? asc(products.name) : desc(products.createdAt);

  const rows = await db
    .select()
    .from(products)
    .where(and(...filters))
    .orderBy(orderBy);

  return ok({ products: rows });
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = productCreateSchema.parse(await req.json());

  const [created] = await db
    .insert(products)
    .values({
      businessId: user.businessId,
      name: body.name,
      description: body.description ?? null,
      unitPrice: body.unitPrice,
      taxRateBps: body.taxRateBps,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();

  return ok(created, 201);
});
