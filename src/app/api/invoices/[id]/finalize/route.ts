import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { finalizeInvoice } from "@/lib/invoice-service";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, id),
        eq(invoices.businessId, user.businessId),
        isNull(invoices.deletedAt),
      ),
    )
    .limit(1);
  if (!invoice) return fail("Invoice not found", 404);
  if (invoice.status !== "draft") {
    return fail("Only draft invoices can be finalized", 409);
  }

  const finalized = await db.transaction((tx) =>
    finalizeInvoice(tx, id, user),
  );

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "invoice.finalize",
    entityType: "invoice",
    entityId: id,
    metadata: { number: finalized.number, total: finalized.total },
  });

  return ok(finalized);
});
