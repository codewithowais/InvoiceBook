import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, customers, invoices, payments } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok } from "@/lib/api";
import { reportRangeSchema } from "@/lib/validation";
import { toISODate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve the requested range, defaulting to the last 12 months. */
function resolveRange(fromRaw?: string, toRaw?: string) {
  const now = new Date();
  const defaultTo = toISODate(now);
  const defaultFrom = toISODate(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)),
  );

  let from = fromRaw && ISO_DATE.test(fromRaw) ? fromRaw : defaultFrom;
  let to = toRaw && ISO_DATE.test(toRaw) ? toRaw : defaultTo;
  // Guard against an inverted range.
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

/** Chronological list of "YYYY-MM" buckets spanning [from, to] inclusive. */
function monthBuckets(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const months: string[] = [];
  let y = fy;
  let m = fm;
  // Cap iterations so a pathological range can never spin forever.
  for (let i = 0; i < 240; i++) {
    if (y > ty || (y === ty && m > tm)) break;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

// Finalized = anything past draft that still counts as billed (excludes void).
const FINALIZED = sql`in ('unpaid','partially_paid','paid')`;
const OPEN_AR = sql`in ('unpaid','partially_paid')`;

export const GET = handler(async (req: Request) => {
  const user = await requireAdmin();
  const businessId = user.businessId;

  const url = new URL(req.url);
  const { from: fromQ, to: toQ } = reportRangeSchema.parse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const { from, to } = resolveRange(fromQ, toQ);
  const today = toISODate(new Date());

  // Business currency for formatting on the client.
  const [business] = await db
    .select({ currency: businesses.defaultCurrency })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  const currency = business?.currency ?? "USD";

  // -- Totals + current AR + overdue snapshot (single invoices scan) --------
  const [invTotals] = await db
    .select({
      billed: sql<string>`coalesce(sum(case when ${invoices.status} ${FINALIZED} and ${invoices.issueDate} >= ${from} and ${invoices.issueDate} <= ${to} then ${invoices.total} else 0 end), 0)`,
      outstanding: sql<string>`coalesce(sum(case when ${invoices.status} ${OPEN_AR} then ${invoices.total} - ${invoices.amountPaid} else 0 end), 0)`,
      overdueCount: sql<string>`coalesce(sum(case when ${invoices.status} ${OPEN_AR} and ${invoices.dueDate} < ${today} then 1 else 0 end), 0)`,
      overdueTotal: sql<string>`coalesce(sum(case when ${invoices.status} ${OPEN_AR} and ${invoices.dueDate} < ${today} then ${invoices.total} - ${invoices.amountPaid} else 0 end), 0)`,
    })
    .from(invoices)
    .where(and(eq(invoices.businessId, businessId), isNull(invoices.deletedAt)));

  // -- Collected: active payments in range (by paidAt), scoped via invoice ---
  const [payTotals] = await db
    .select({
      collected: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(
      and(
        eq(invoices.businessId, businessId),
        isNull(invoices.deletedAt),
        eq(payments.status, "active"),
        sql`${payments.paidAt} >= ${from}`,
        sql`${payments.paidAt} <= ${to}`,
      ),
    );

  // -- Monthly billed (finalized invoices by issue month) -------------------
  const billedRows = await db
    .select({
      month: sql<string>`to_char(${invoices.issueDate}, 'YYYY-MM')`,
      billed: sql<string>`coalesce(sum(${invoices.total}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.businessId, businessId),
        isNull(invoices.deletedAt),
        sql`${invoices.status} ${FINALIZED}`,
        sql`${invoices.issueDate} >= ${from}`,
        sql`${invoices.issueDate} <= ${to}`,
      ),
    )
    .groupBy(sql`to_char(${invoices.issueDate}, 'YYYY-MM')`);

  // -- Monthly collected (active payments by paid month) --------------------
  const collectedRows = await db
    .select({
      month: sql<string>`to_char(${payments.paidAt}, 'YYYY-MM')`,
      collected: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(
      and(
        eq(invoices.businessId, businessId),
        isNull(invoices.deletedAt),
        eq(payments.status, "active"),
        sql`${payments.paidAt} >= ${from}`,
        sql`${payments.paidAt} <= ${to}`,
      ),
    )
    .groupBy(sql`to_char(${payments.paidAt}, 'YYYY-MM')`);

  const billedByMonth: Record<string, number> = {};
  for (const r of billedRows) billedByMonth[r.month] = Number(r.billed);
  const collectedByMonth: Record<string, number> = {};
  for (const r of collectedRows) collectedByMonth[r.month] = Number(r.collected);

  const monthly = monthBuckets(from, to).map((month) => ({
    month,
    billed: billedByMonth[month] ?? 0,
    collected: collectedByMonth[month] ?? 0,
  }));

  // -- By status (current book snapshot, excludes drafts) -------------------
  const statusRows = await db
    .select({
      status: invoices.status,
      count: sql<string>`count(*)`,
      total: sql<string>`coalesce(sum(${invoices.total}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.businessId, businessId),
        isNull(invoices.deletedAt),
        sql`${invoices.status} <> 'draft'`,
      ),
    )
    .groupBy(invoices.status);

  const byStatus: { status: string; count: number; total: number }[] = statusRows
    .map((r) => ({
      status: r.status as string,
      count: Number(r.count),
      total: Number(r.total),
    }))
    .sort((a, b) => b.total - a.total);
  // Derived "overdue" bucket (subset of unpaid/partially_paid past due date).
  byStatus.push({
    status: "overdue",
    count: Number(invTotals?.overdueCount ?? 0),
    total: Number(invTotals?.overdueTotal ?? 0),
  });

  // -- By customer: billed + outstanding (invoices) and collected (payments) -
  const custInvoiceRows = await db
    .select({
      customerId: invoices.customerId,
      name: customers.name,
      billed: sql<string>`coalesce(sum(case when ${invoices.status} ${FINALIZED} and ${invoices.issueDate} >= ${from} and ${invoices.issueDate} <= ${to} then ${invoices.total} else 0 end), 0)`,
      outstanding: sql<string>`coalesce(sum(case when ${invoices.status} ${OPEN_AR} then ${invoices.total} - ${invoices.amountPaid} else 0 end), 0)`,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.businessId, businessId), isNull(invoices.deletedAt)))
    .groupBy(invoices.customerId, customers.name);

  const custPaymentRows = await db
    .select({
      customerId: invoices.customerId,
      collected: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(
      and(
        eq(invoices.businessId, businessId),
        isNull(invoices.deletedAt),
        eq(payments.status, "active"),
        sql`${payments.paidAt} >= ${from}`,
        sql`${payments.paidAt} <= ${to}`,
      ),
    )
    .groupBy(invoices.customerId);

  const collectedByCust: Record<string, number> = {};
  for (const r of custPaymentRows) {
    collectedByCust[r.customerId] = Number(r.collected);
  }

  const byCustomer = custInvoiceRows
    .map((r) => ({
      customerId: r.customerId,
      name: r.name,
      billed: Number(r.billed),
      collected: collectedByCust[r.customerId] ?? 0,
      outstanding: Number(r.outstanding),
    }))
    // Drop customers with no activity in scope at all.
    .filter((c) => c.billed !== 0 || c.collected !== 0 || c.outstanding !== 0)
    .sort((a, b) => b.billed - a.billed || b.collected - a.collected)
    .slice(0, 10);

  return ok({
    range: { from, to },
    totals: {
      billed: Number(invTotals?.billed ?? 0),
      collected: Number(payTotals?.collected ?? 0),
      outstanding: Number(invTotals?.outstanding ?? 0),
      currency,
    },
    monthly,
    byStatus,
    byCustomer,
  });
});
