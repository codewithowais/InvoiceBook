import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { businessUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const user = await requireUser();
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, user.businessId))
    .limit(1);
  if (!biz) return fail("Business not found", 404);
  return ok(biz);
});

export const PATCH = handler(async (req: Request) => {
  const user = await requireAdmin();
  const body = businessUpdateSchema.parse(await req.json());

  const [updated] = await db
    .update(businesses)
    .set({
      name: body.name,
      addressLine1: body.addressLine1 ?? null,
      addressLine2: body.addressLine2 ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      postalCode: body.postalCode ?? null,
      country: body.country ?? null,
      logoUrl: body.logoUrl ?? null,
      bankDetails: body.bankDetails ?? null,
      defaultCurrency: body.defaultCurrency,
      invoicePrefix: body.invoicePrefix,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, user.businessId))
    .returning();

  if (!updated) return fail("Business not found", 404);
  return ok(updated);
});
