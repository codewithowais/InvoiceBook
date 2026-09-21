import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices, payments } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Invoice, Payment } from "@/db/schema";
import { paymentSchema } from "@/lib/validation";
import { recalcInvoiceStatus } from "@/lib/invoice-service";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const { allowed, retryAfter } = checkRateLimit(
    `${user.id}:payment`,
    30,
    60_000,
  );
  if (!allowed) return fail(`Too many requests, retry in ${retryAfter}s`, 429);

  // Scope the invoice to the caller's business (prevent IDOR).
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
  if (invoice.status === "draft") {
    return fail("Finalize the invoice before recording payments", 409);
  }
  if (invoice.status === "void") {
    return fail("Cannot record a payment on a void invoice", 409);
  }

  const body = paymentSchema.parse(await req.json());

  type TxResult =
    | { ok: false; error: string }
    | { ok: true; payment: Payment; invoice: Invoice };

  const result = await db.transaction(async (tx): Promise<TxResult> => {
    // Lock the invoice row so concurrent payments serialize.
    const [locked] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .for("update")
      .limit(1);

    const [agg] = await tx
      .select({ paid: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(and(eq(payments.invoiceId, id), eq(payments.status, "active")));

    const alreadyPaid = Number(agg?.paid ?? 0);
    const remaining = locked.total - alreadyPaid;

    if (body.amount > remaining) {
      return {
        ok: false,
        error: `Payment exceeds remaining balance (${remaining})`,
      };
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        invoiceId: id,
        amount: body.amount,
        method: body.method,
        paidAt: body.paidAt,
        reference: body.reference ?? null,
        proofBlobKey: body.proofBlobKey,
        proofFileName: body.proofFileName,
        proofContentType: body.proofContentType,
        status: "active",
        createdBy: user.id,
      })
      .returning();

    const invoiceAfter = await recalcInvoiceStatus(tx, id);
    return { ok: true, payment, invoice: invoiceAfter };
  });

  if (!result.ok) return fail(result.error, 400);

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "payment.record",
    entityType: "payment",
    entityId: result.payment.id,
    metadata: {
      invoiceId: id,
      invoiceNumber: result.invoice.number,
      amount: result.payment.amount,
      method: result.payment.method,
    },
  });

  return ok({ payment: result.payment, invoice: result.invoice }, 201);
});
