import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  invoiceItems,
  invoices,
  payments,
  user as userTable,
} from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { invoiceUpdateSchema } from "@/lib/validation";
import { computeTotals } from "@/lib/money";
import { signedProofUrl } from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadInvoice(id: string, businessId: string) {
  const [row] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, id),
        eq(invoices.businessId, businessId),
        isNull(invoices.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const invoice = await loadInvoice(id, user.businessId);
  if (!invoice) return fail("Invoice not found", 404);

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(asc(invoiceItems.sortOrder));

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(asc(payments.createdAt));

  const paymentsWithUrls = await Promise.all(
    paymentRows.map(async (p) => ({
      ...p,
      proofUrl: p.proofBlobKey ? await signedProofUrl(p.proofBlobKey) : null,
    })),
  );

  // Audit trail (Phase 2): resolve the names behind createdBy / updatedBy so
  // the detail page can show "Created by X · Last updated by Y".
  const auditIds = [invoice.createdBy, invoice.updatedBy].filter(
    (v): v is string => Boolean(v),
  );
  const nameById = new Map<string, string>();
  if (auditIds.length > 0) {
    const rows = await db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(inArray(userTable.id, auditIds));
    for (const r of rows) nameById.set(r.id, r.name);
  }

  return ok({
    invoice,
    items,
    payments: paymentsWithUrls,
    outstanding: invoice.total - invoice.amountPaid,
    createdByName: invoice.createdBy
      ? nameById.get(invoice.createdBy) ?? null
      : null,
    updatedByName: invoice.updatedBy
      ? nameById.get(invoice.updatedBy) ?? null
      : null,
  });
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const invoice = await loadInvoice(id, user.businessId);
  if (!invoice) return fail("Invoice not found", 404);
  if (invoice.status !== "draft") {
    return fail("Only draft invoices can be edited", 409);
  }

  const body = invoiceUpdateSchema.parse(await req.json());

  // If reassigning the customer, verify it belongs to this business.
  if (body.customerId && body.customerId !== invoice.customerId) {
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

  const discountType = body.discountType ?? invoice.discountType;
  const discountValue = body.discountValue ?? invoice.discountValue;

  const updated = await db.transaction(async (tx) => {
    // Determine the item set used for totals: new items if provided, else current.
    let itemsForTotals: {
      description: string;
      quantity: number;
      unitPrice: number;
      taxRateBps: number;
    }[];

    if (body.items) {
      itemsForTotals = body.items;
    } else {
      const existing = await tx
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id))
        .orderBy(asc(invoiceItems.sortOrder));
      itemsForTotals = existing.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRateBps: it.taxRateBps,
      }));
    }

    const totals = computeTotals({
      items: itemsForTotals.map((it) => ({
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRateBps: it.taxRateBps,
      })),
      discountType,
      discountValue,
    });

    const [inv] = await tx
      .update(invoices)
      .set({
        ...(body.customerId ? { customerId: body.customerId } : {}),
        ...(body.issueDate ? { issueDate: body.issueDate } : {}),
        ...(body.dueDate ? { dueDate: body.dueDate } : {}),
        ...(body.currency ? { currency: body.currency } : {}),
        ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
        ...(body.terms !== undefined ? { terms: body.terms ?? null } : {}),
        discountType,
        discountValue,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id))
      .returning();

    if (body.items) {
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      await tx.insert(invoiceItems).values(
        body.items.map((it, i) => {
          const line = totals.lines[i];
          return {
            invoiceId: id,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            taxRateBps: it.taxRateBps,
            lineSubtotal: line.lineSubtotal,
            lineTax: line.lineTax,
            lineTotal: line.lineTotal,
            sortOrder: i,
          };
        }),
      );
    }

    return inv;
  });

  return ok(updated);
});
