import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok } from "@/lib/api";
import { customerCreateSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

const PAGE_SIZE = 20;

export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const sort = url.searchParams.get("sort") ?? "createdAt";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);

  const filters = [
    eq(customers.businessId, user.businessId),
    isNull(customers.deletedAt),
  ];
  if (search) {
    const like = `%${search}%`;
    filters.push(
      or(ilike(customers.name, like), ilike(customers.email, like))!,
    );
  }

  const orderBy =
    sort === "name"
      ? asc(customers.name)
      : sort === "email"
        ? asc(customers.email)
        : desc(customers.createdAt);

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      billingAddress: customers.billingAddress,
      notes: customers.notes,
      createdAt: customers.createdAt,
      outstanding: sql<string>`coalesce((select sum(i.total - i.amount_paid) from invoices i where i.customer_id = ${customers.id} and i.status in ('unpaid','partially_paid') and i.deleted_at is null), 0)`,
      lastInvoiceDate: sql<
        string | null
      >`(select max(i.issue_date) from invoices i where i.customer_id = ${customers.id} and i.deleted_at is null)`,
    })
    .from(customers)
    .where(and(...filters))
    .orderBy(orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [{ total }] = await db
    .select({ total: sql<string>`count(*)` })
    .from(customers)
    .where(and(...filters));

  return ok({
    customers: rows.map((r) => ({
      ...r,
      outstanding: Number(r.outstanding),
    })),
    page,
    pageSize: PAGE_SIZE,
    total: Number(total),
  });
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = customerCreateSchema.parse(await req.json());

  const [created] = await db
    .insert(customers)
    .values({
      businessId: user.businessId,
      name: body.name,
      email: body.email,
      phone: body.phone ?? null,
      billingAddress: body.billingAddress ?? null,
      notes: body.notes ?? null,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "customer.create",
    entityType: "customer",
    entityId: created.id,
    metadata: { name: created.name, email: created.email },
  });

  return ok(created, 201);
});
