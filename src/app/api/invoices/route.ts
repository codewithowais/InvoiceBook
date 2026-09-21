import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, invoiceItems, invoices } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { invoiceCreateSchema } from "@/lib/validation";
import { computeTotals } from "@/lib/money";
import { toISODate } from "@/lib/format";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

const PAGE_SIZE = 20;

export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim();
  const search = url.searchParams.get("search")?.trim();
  const sort = url.searchParams.get("sort") ?? "createdAt";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const today = toISODate(new Date());

  const filters = [
    eq(invoices.businessId, user.businessId),
    isNull(invoices.deletedAt),
  ];

  if (status === "overdue") {
    filters.push(
      sql`${invoices.status} in ('unpaid','partially_paid') and ${invoices.dueDate} < ${today}`,
    );
  } else if (status) {
    filters.push(eq(invoices.status, status as never));
  }

  if (search) {
    const like = `%${search}%`;
    filters.push(
      or(ilike(invoices.number, like), ilike(customers.name, like))!,
    );
  }

  const orderBy =
    sort === "dueDate"
      ? asc(invoices.dueDate)
      : sort === "total"
        ? desc(invoices.total)
        : desc(invoices.createdAt);

  const rows = await db
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
      createdAt: invoices.createdAt,
      outstanding: sql<number>`${invoices.total} - ${invoices.amountPaid}`,
      overdue: sql<boolean>`(${invoices.status} in ('unpaid','partially_paid') and ${invoices.dueDate} < ${today})`,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(...filters))
    .orderBy(orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ total }] = await db
    .select({ total: sql<string>`count(*)` })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(...filters));

  return ok({
    invoices: rows,
    page,
    pageSize: PAGE_SIZE,
    total: Number(total),
  });
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = invoiceCreateSchema.parse(await req.json());

  // Verify the customer belongs to the caller's business (prevent IDOR).
  const [customer] = await db
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
  if (!customer) return fail("Customer not found", 404);

  const totals = computeTotals({
    items: body.items.map((it) => ({
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      taxRateBps: it.taxRateBps,
    })),
    discountType: body.discountType,
    discountValue: body.discountValue,
  });

  const created = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(invoices)
      .values({
        businessId: user.businessId,
        customerId: body.customerId,
        status: "draft",
        currency: body.currency,
        issueDate: body.issueDate,
        dueDate: body.dueDate,
        subtotal: totals.subtotal,
        discountType: body.discountType,
        discountValue: body.discountValue,
        taxTotal: totals.taxTotal,
        total: totals.total,
        notes: body.notes ?? null,
        terms: body.terms ?? null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await tx.insert(invoiceItems).values(
      body.items.map((it, i) => {
        const line = totals.lines[i];
        return {
          invoiceId: invoice.id,
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

    return invoice;
  });

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "invoice.create",
    entityType: "invoice",
    entityId: created.id,
    metadata: {
      total: created.total,
      currency: created.currency,
      customerId: created.customerId,
    },
  });

  return ok(created, 201);
});
