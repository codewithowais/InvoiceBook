import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, invoices } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler } from "@/lib/api";
import { reportRangeSchema } from "@/lib/validation";
import { toISODate, statusLabel, isOverdue } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function resolveRange(fromRaw?: string, toRaw?: string) {
  const now = new Date();
  const defaultTo = toISODate(now);
  const defaultFrom = toISODate(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)),
  );
  let from = fromRaw && ISO_DATE.test(fromRaw) ? fromRaw : defaultFrom;
  let to = toRaw && ISO_DATE.test(toRaw) ? toRaw : defaultTo;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

/** Minor units -> plain decimal string with 2 dp (no currency symbol). */
function toDecimal(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** RFC-4180 field escaping: quote when needed and double inner quotes. */
function csvField(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  // Defang spreadsheet formula injection: a leading =, +, -, @, tab or CR can
  // execute as a formula in Excel/Sheets. Prefix with a single quote so the
  // cell is treated as text.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(csvField).join(",") + "\r\n";
}

export const GET = handler(async (req: Request) => {
  const user = await requireAdmin();
  const businessId = user.businessId;

  const url = new URL(req.url);
  const { from: fromQ, to: toQ } = reportRangeSchema.parse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const { from, to } = resolveRange(fromQ, toQ);

  // Invoice-level rows for the range (by issue date). Excludes soft-deleted
  // and drafts (drafts are not real billed documents); void kept for the
  // accountant's record.
  const rows = await db
    .select({
      number: invoices.number,
      customerName: customers.name,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      currency: invoices.currency,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(
      and(
        eq(invoices.businessId, businessId),
        isNull(invoices.deletedAt),
        sql`${invoices.status} <> 'draft'`,
        sql`${invoices.issueDate} >= ${from}`,
        sql`${invoices.issueDate} <= ${to}`,
      ),
    )
    .orderBy(asc(invoices.issueDate), asc(invoices.number));

  const header = [
    "Invoice number",
    "Customer",
    "Status",
    "Issue date",
    "Due date",
    "Currency",
    "Total",
    "Amount paid",
    "Outstanding",
  ];

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(csvRow(header)));
      for (const r of rows) {
        const outstanding = r.total - r.amountPaid;
        const displayStatus = isOverdue(r.dueDate, r.status)
          ? "Overdue"
          : statusLabel(r.status);
        controller.enqueue(
          enc.encode(
            csvRow([
              r.number ?? "",
              r.customerName,
              displayStatus,
              r.issueDate,
              r.dueDate,
              r.currency,
              toDecimal(r.total),
              toDecimal(r.amountPaid),
              toDecimal(outstanding),
            ]),
          ),
        );
      }
      controller.close();
    },
  });

  const filename = `invoiceflow-report-${from}-${to}.csv`;
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
