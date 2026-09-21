import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

// NOTE: Next.js requires one slug name per dynamic segment, so this route
// shares the `[token]` folder with the public token lookup. Here the segment
// carries the invitation *id* — the URL is POST /api/team/invite/:id/revoke.
type Ctx = { params: Promise<{ token: string }> };

/**
 * POST /api/team/invite/[id]/revoke — admin only.
 * Marks a still-pending invitation as revoked. Strictly scoped to the caller's
 * businessId (IDOR) and only acts on invites that are currently pending.
 */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { token: id } = await ctx.params;

  const [invite] = await db
    .select({ id: invitations.id, status: invitations.status })
    .from(invitations)
    .where(
      and(
        eq(invitations.id, id),
        eq(invitations.businessId, admin.businessId),
      ),
    )
    .limit(1);

  if (!invite) return fail("Invitation not found", 404);
  if (invite.status !== "pending") {
    return fail("Only pending invitations can be revoked.", 409);
  }

  const [updated] = await db
    .update(invitations)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(
      and(
        eq(invitations.id, id),
        eq(invitations.businessId, admin.businessId),
        eq(invitations.status, "pending"),
      ),
    )
    .returning({ id: invitations.id, status: invitations.status });

  if (!updated) return fail("Only pending invitations can be revoked.", 409);
  return ok(updated);
});
