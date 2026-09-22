import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { recurringPlans } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { runPlanCycle } from "@/lib/invoice-service";
import { emailInvoiceById } from "@/lib/invoice-email";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireAdmin();
  const { id } = await ctx.params;

  let issueDate: string | null | undefined;
  try {
    issueDate = bodySchema.parse((await req.json()) ?? {}).issueDate;
  } catch {
    issueDate = undefined;
  }

  const [plan] = await db
    .select()
    .from(recurringPlans)
    .where(
      and(
        eq(recurringPlans.id, id),
        eq(recurringPlans.businessId, user.businessId),
        isNull(recurringPlans.deletedAt),
      ),
    )
    .limit(1);
  if (!plan) return fail("Recurring plan not found", 404);
  if (plan.status === "ended") {
    return fail("Cannot generate from an ended plan", 409);
  }

  // Run one cycle immediately (same routine as the cron): create the invoice
  // and advance the plan's counters/nextRunDate atomically.
  const invoice = await db.transaction((tx) =>
    runPlanCycle(tx, plan, user, issueDate),
  );

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "recurring.generate",
    entityType: "recurring_plan",
    entityId: id,
    metadata: { invoiceId: invoice.id, number: invoice.number },
  });

  // Auto-email if the plan opted in. Best-effort — the invoice was created
  // regardless, so a send failure is reported but doesn't fail the request.
  let emailed = false;
  let emailError: string | undefined;
  if (plan.autoEmail) {
    try {
      await emailInvoiceById(invoice.id, invoice.businessId);
      emailed = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : "send failed";
    }
  }

  return ok({ invoice, emailed, emailError }, 201);
});
