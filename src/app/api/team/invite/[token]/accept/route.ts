import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  businesses,
  customers,
  invitations,
  invoices,
  user as userTable,
} from "@/db/schema";
import { requireUser } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Accept a team invitation. Security model: acceptance is bound to the invite
 * TOKEN (the secret), never to the email alone. The caller must be signed in
 * (the account they just created), the token must be valid + pending, and the
 * invited email must match the caller's email. We only re-home a fresh, empty
 * account so an existing business is never silently abandoned.
 */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { token } = await ctx.params;

  const [invite] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);

  if (!invite) return fail("Invite not found", 404);
  if (invite.status !== "pending") {
    return fail("This invite has already been used or was revoked", 409);
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    return fail("This invite has expired", 409);
  }
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return fail("This invite was issued for a different email address", 403);
  }
  if (invite.businessId === user.businessId) {
    return fail("You are already a member of this business", 409);
  }

  type Result =
    | { ok: true; businessId: string }
    | { ok: false; error: string; status: number };

  const oldBusinessId = user.businessId;

  const result = await db.transaction(async (tx): Promise<Result> => {
    // Only fresh, empty accounts may accept — protect an existing business
    // (with data or teammates) from being abandoned by accepting an invite.
    const [{ n: memberCount }] = await tx
      .select({ n: count() })
      .from(userTable)
      .where(eq(userTable.businessId, oldBusinessId));
    const [{ n: invCount }] = await tx
      .select({ n: count() })
      .from(invoices)
      .where(eq(invoices.businessId, oldBusinessId));
    const [{ n: custCount }] = await tx
      .select({ n: count() })
      .from(customers)
      .where(eq(customers.businessId, oldBusinessId));

    if (memberCount > 1 || invCount > 0 || custCount > 0) {
      return {
        ok: false,
        status: 409,
        error:
          "You already belong to an active business. Sign out and create a new account to accept this invite.",
      };
    }

    // Consume the invite atomically (guarded on pending → prevents re-use).
    const consumed = await tx
      .update(invitations)
      .set({ status: "accepted", acceptedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invitations.id, invite.id), eq(invitations.status, "pending")))
      .returning({ id: invitations.id });

    if (consumed.length === 0) {
      return { ok: false, status: 409, error: "This invite has already been used" };
    }

    // Move the user into the inviting business with the invited role.
    await tx
      .update(userTable)
      .set({ businessId: invite.businessId, role: invite.role, updatedAt: new Date() })
      .where(eq(userTable.id, user.id));

    // The auto-created starter business is now empty and orphaned — remove it.
    await tx.delete(businesses).where(eq(businesses.id, oldBusinessId));

    return { ok: true, businessId: invite.businessId };
  });

  if (!result.ok) return fail(result.error, result.status);
  return ok({ joined: true, businessId: result.businessId });
});
