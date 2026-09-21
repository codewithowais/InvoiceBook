import { z } from "zod";
import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { emailInvoiceById, EmailInvoiceError } from "@/lib/invoice-email";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  message: z.string().max(2000).optional().nullable(),
});

export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const { allowed, retryAfter } = checkRateLimit(`${user.id}:send`, 20, 60_000);
  if (!allowed) return fail(`Too many requests, retry in ${retryAfter}s`, 429);

  let message: string | null | undefined;
  try {
    const raw = await req.json();
    message = bodySchema.parse(raw ?? {}).message;
  } catch {
    message = undefined;
  }

  try {
    const result = await emailInvoiceById(id, user.businessId, message);
    await logActivity({
      businessId: user.businessId,
      actorId: user.id,
      action: "invoice.send",
      entityType: "invoice",
      entityId: id,
      metadata: { to: result.to },
    });
    return ok(result);
  } catch (err) {
    if (err instanceof EmailInvoiceError) return fail(err.message, err.status);
    throw err;
  }
});
