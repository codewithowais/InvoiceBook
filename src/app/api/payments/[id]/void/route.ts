import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, payments } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { recalcInvoiceStatus } from "@/lib/invoice-service";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  // Scope the payment to the caller's business via its invoice.
  const [row] = await db
    .select({
      paymentId: payments.id,
      invoiceId: payments.invoiceId,
      status: payments.status,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(eq(payments.id, id), eq(invoices.businessId, user.businessId)))
    .limit(1);

  if (!row) return fail("Payment not found", 404);
  if (row.status === "void") return fail("Payment is already void", 409);

  const result = await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: "void", updatedAt: new Date() })
      .where(eq(payments.id, id));

    const invoice = await recalcInvoiceStatus(tx, row.invoiceId);
    return invoice;
  });

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "payment.void",
    entityType: "payment",
    entityId: id,
    metadata: { invoiceId: row.invoiceId, invoiceNumber: result.number },
  });

  return ok({ invoice: result });
});
