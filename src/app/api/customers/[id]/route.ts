import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, invoices } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { customerUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function loadCustomer(id: string, businessId: string) {
  const [row] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.id, id),
        eq(customers.businessId, businessId),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const customer = await loadCustomer(id, user.businessId);
  if (!customer) return fail("Customer not found", 404);

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.customerId, id),
        eq(invoices.businessId, user.businessId),
        isNull(invoices.deletedAt),
      ),
    )
    .orderBy(desc(invoices.createdAt));

  const [totals] = await db
    .select({
      billed: sql<string>`coalesce(sum(case when ${invoices.status} <> 'void' then ${invoices.total} else 0 end), 0)`,
      paid: sql<string>`coalesce(sum(case when ${invoices.status} <> 'void' then ${invoices.amountPaid} else 0 end), 0)`,
      outstanding: sql<string>`coalesce(sum(case when ${invoices.status} in ('unpaid','partially_paid') then ${invoices.total} - ${invoices.amountPaid} else 0 end), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.customerId, id),
        eq(invoices.businessId, user.businessId),
        isNull(invoices.deletedAt),
      ),
    );

  return ok({
    customer,
    invoices: invoiceRows,
    totals: {
      billed: Number(totals?.billed ?? 0),
      paid: Number(totals?.paid ?? 0),
      outstanding: Number(totals?.outstanding ?? 0),
    },
  });
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const existing = await loadCustomer(id, user.businessId);
  if (!existing) return fail("Customer not found", 404);

  const body = customerUpdateSchema.parse(await req.json());

  const [updated] = await db
    .update(customers)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone ?? null } : {}),
      ...(body.billingAddress !== undefined
        ? { billingAddress: body.billingAddress ?? null }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(
      and(eq(customers.id, id), eq(customers.businessId, user.businessId)),
    )
    .returning();

  return ok(updated);
});
