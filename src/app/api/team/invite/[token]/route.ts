import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { businesses, invitations } from "@/db/schema";
import { handler, ok } from "@/lib/api";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/**
 * GET /api/team/invite/[token] — PUBLIC (no auth).
 * Backs the accept-invite page. Returns only what that page needs and never
 * leaks anything else: { email, role, businessName, valid }. Any invalid,
 * revoked, accepted or expired token resolves to { valid: false } with no
 * other detail.
 */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { token } = await ctx.params;

  const [row] = await db
    .select({
      email: invitations.email,
      role: invitations.role,
      businessName: businesses.name,
    })
    .from(invitations)
    .innerJoin(businesses, eq(invitations.businessId, businesses.id))
    .where(
      and(
        eq(invitations.token, token),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    return ok({ valid: false });
  }

  return ok({
    valid: true,
    email: row.email,
    role: row.role,
    businessName: row.businessName,
  });
});
