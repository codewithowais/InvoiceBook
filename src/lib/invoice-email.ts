import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { buildInvoicePdfForBusiness } from "@/lib/invoice-pdf";
import { sendInvoiceEmail } from "@/lib/email";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";

export type EmailInvoiceResult = {
  sentAt: Date;
  to: string;
  previewUrl?: string;
};

export class EmailInvoiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Render an invoice's PDF and email it to the customer, then stamp `sentAt`.
 * Used by the manual "Send" route and by recurring auto-email. Only finalized
 * (non-draft, non-void) invoices can be sent.
 */
export async function emailInvoiceById(
  invoiceId: string,
  businessId: string,
  message?: string | null,
): Promise<EmailInvoiceResult> {
  const built = await buildInvoicePdfForBusiness(invoiceId, businessId);
  if (!built) throw new EmailInvoiceError("Invoice not found", 404);

  const { invoice, customer, business, pdf, fileName } = built;

  if (invoice.status === "draft") {
    throw new EmailInvoiceError("Finalize the invoice before sending", 409);
  }
  if (invoice.status === "void") {
    throw new EmailInvoiceError("Cannot send a void invoice", 409);
  }
  if (!customer.email) {
    throw new EmailInvoiceError("Customer has no email address", 422);
  }

  const outstanding = invoice.total - invoice.amountPaid;
  const send = await sendInvoiceEmail({
    to: customer.email,
    businessName: business.name,
    invoiceNumber: invoice.number ?? "Invoice",
    amountLabel: formatMoney(outstanding, invoice.currency),
    dueDateLabel: formatDate(invoice.dueDate),
    message,
    pdf,
    pdfFilename: fileName,
  });

  const sentAt = new Date();
  await db
    .update(invoices)
    .set({ sentAt, updatedAt: sentAt })
    .where(eq(invoices.id, invoiceId));

  const result: EmailInvoiceResult = { sentAt, to: customer.email };
  if (send.previewUrl) result.previewUrl = send.previewUrl;
  return result;
}
