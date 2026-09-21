import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses, customers, invoiceItems, invoices } from "@/db/schema";
import { renderInvoicePdf } from "@/lib/pdf";
import type { BusinessSnapshot, CustomerSnapshot } from "@/lib/invoice-service";
import type { Invoice } from "@/db/schema";

export type BuiltInvoicePdf = {
  pdf: Buffer;
  invoice: Invoice;
  customer: CustomerSnapshot;
  business: BusinessSnapshot;
  fileName: string;
};

/**
 * Fetch an invoice (scoped to a business) with its items, resolve the
 * customer/business snapshots (falling back to live rows for drafts), render
 * the PDF, and return everything callers need. Returns null if not found.
 */
export async function buildInvoicePdfForBusiness(
  invoiceId: string,
  businessId: string,
): Promise<BuiltInvoicePdf | null> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.businessId, businessId),
        isNull(invoices.deletedAt),
      ),
    )
    .limit(1);
  if (!invoice) return null;

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceItems.sortOrder));

  let customer = invoice.customerSnapshot as CustomerSnapshot | null;
  let business = invoice.businessSnapshot as BusinessSnapshot | null;

  if (!customer) {
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, invoice.customerId))
      .limit(1);
    if (!c) return null;
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
    if (!b) return null;
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
  return { pdf, invoice, customer, business, fileName };
}
