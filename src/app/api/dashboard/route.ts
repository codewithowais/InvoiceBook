import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, customers, invoices, payments } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok } from "@/lib/api";
import { toISODate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();
  const businessId = user.businessId;
  const today = toISODate(new Date());

  const now = new Date();
  const monthStart = toISODate(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  );
  const monthEnd = toISODate(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  );

  const [biz] = await db
    .select({ currency: businesses.defaultCurrency })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  const currency = biz?.currency ?? "USD";

  const [invAgg] = await db
    .select({
      totalOutstanding: sql<string>`coalesce(sum(case when ${invoices.status} in ('unpaid','partially_paid') then ${invoices.total} - ${invoices.amountPaid} else 0 end), 0)`,
      overdueCount: sql<string>`coalesce(sum(case when ${invoices.status} in ('unpaid','partially_paid') and ${invoices.dueDate} < ${today} then 1 else 0 end), 0)`,
      draftCount: sql<string>`coalesce(sum(case when ${invoices.status} = 'draft' then 1 else 0 end), 0)`,
      invoiceCount: sql<string>`count(*)`,
    })
    .from(invoices)
    .where(
      and(eq(invoices.businessId, businessId), isNull(invoices.deletedAt)),
    );

  const [payAgg] = await db
    .select({
      paidThisMonth: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(
      and(
        eq(invoices.businessId, businessId),
        isNull(invoices.deletedAt),
        eq(payments.status, "active"),
        sql`${payments.paidAt} >= ${monthStart}`,
        sql`${payments.paidAt} < ${monthEnd}`,
      ),
    );

  const [custAgg] = await db
    .select({ n: count() })
    .from(customers)
    .where(
      and(eq(customers.businessId, businessId), isNull(customers.deletedAt)),
    );

  const recentRows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      currency: invoices.currency,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      customerId: invoices.customerId,
      customerName: customers.name,
      finalizedAt: invoices.finalizedAt,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.businessId, businessId), isNull(invoices.deletedAt)))
    .orderBy(desc(invoices.createdAt))
    .limit(6);

  const recentInvoices = recentRows.map((r) => ({
    ...r,
    outstanding: r.total - r.amountPaid,
  }));

  return ok({
    totalOutstanding: Number(invAgg?.totalOutstanding ?? 0),
    paidThisMonth: Number(payAgg?.paidThisMonth ?? 0),
    overdueCount: Number(invAgg?.overdueCount ?? 0),
    draftCount: Number(invAgg?.draftCount ?? 0),
    invoiceCount: Number(invAgg?.invoiceCount ?? 0),
    customerCount: custAgg?.n ?? 0,
    currency,
    recentInvoices,
  });
});
