import { handler, ok, fail } from "@/lib/api";
import { env } from "@/env";
import { runDueRecurringPlans } from "@/lib/invoice-service";
import { emailInvoiceById } from "@/lib/invoice-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  // Protected by a shared secret, not a user session (invoked by Vercel Cron).
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return fail("Unauthorized", 401);
  }

  const result = await runDueRecurringPlans(new Date());

  // Auto-email generated invoices for plans that opted in. Best-effort: a
  // send failure must not fail the whole cron run or block other invoices.
  let emailed = 0;
  const emailErrors: string[] = [];
  for (const inv of result.created) {
    if (!inv.autoEmail) continue;
    try {
      await emailInvoiceById(inv.invoiceId, inv.businessId);
      emailed++;
    } catch (err) {
      emailErrors.push(
        `${inv.number ?? inv.invoiceId}: ${err instanceof Error ? err.message : "send failed"}`,
      );
    }
  }

  return ok({ ...result, emailed, emailErrors });
});
