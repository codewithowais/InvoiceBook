import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, customers, invoiceItems, invoices } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, fail } from "@/lib/api";
import { renderInvoicePdf } from "@/lib/pdf";
import type {
  BusinessSnapshot,
  CustomerSnapshot,
} from "@/lib/invoice-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
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

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(asc(invoiceItems.sortOrder));

  // Prefer the immutable snapshots frozen at finalize; fall back to live rows
  // for drafts (not yet snapshotted).
  let customer = invoice.customerSnapshot as CustomerSnapshot | null;
  let business = invoice.businessSnapshot as BusinessSnapshot | null;

  if (!customer) {
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, invoice.customerId))
      .limit(1);
    if (!c) return fail("Customer not found", 404);
    customer = {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      billingAddress: c.billingAddress,
    };
  }

  if (!business) {
    const [b] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, invoice.businessId))
      .limit(1);
    if (!b) return fail("Business not found", 404);
    business = {
      id: b.id,
      name: b.name,
      addressLine1: b.addressLine1,
      addressLine2: b.addressLine2,
      city: b.city,
      state: b.state,
      postalCode: b.postalCode,
      country: b.country,
      logoUrl: b.logoUrl,
      bankDetails: b.bankDetails,
    };
  }

  const pdf = await renderInvoicePdf({ invoice, items, business, customer });
  const fileName = `${invoice.number ?? "draft"}.pdf`;

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
