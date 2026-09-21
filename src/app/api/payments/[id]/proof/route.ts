import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, payments } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, fail } from "@/lib/api";
import { signedProofUrl } from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  // Join through the invoice so we only expose proofs for this business.
  const [row] = await db
    .select({
      proofBlobKey: payments.proofBlobKey,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(eq(payments.id, id), eq(invoices.businessId, user.businessId)))
    .limit(1);

  if (!row) return fail("Payment not found", 404);
  if (!row.proofBlobKey) return fail("No proof attached to this payment", 404);

  const url = await signedProofUrl(row.proofBlobKey);
  return new Response(null, { status: 302, headers: { Location: url } });
});
