import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { invitations, user as userTable } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { inviteCreateSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";
import { env } from "@/env";

export const runtime = "nodejs";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * POST /api/team/invite — admin only.
 * Creates a pending invitation carrying a random token. Rejects if the email
 * already belongs to a member of this business or already has a pending,
 * non-expired invite. Returns the invitation plus a copyable `inviteUrl`
 * (email delivery is a separate vertical; the admin shares the link for now).
 */
export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin();

  // Rate-limit per user so an admin can't spray invites.
  const { allowed, retryAfter } = checkRateLimit(
    `team-invite:${admin.id}`,
    10,
    60_000,
  );
  if (!allowed) {
    return fail(
      `Too many invites. Try again in ${retryAfter}s.`,
      429,
    );
  }

  const body = inviteCreateSchema.parse(await req.json());
  const email = body.email.trim().toLowerCase();

  // Already a member of this business?
  const [existingMember] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(
      and(
        eq(userTable.businessId, admin.businessId),
        eq(userTable.email, email),
      ),
    )
    .limit(1);
  if (existingMember) {
    return fail("That email is already a member of your team.", 409);
  }

  // Already has a pending, non-expired invite for this business?
  const [existingInvite] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.businessId, admin.businessId),
        eq(invitations.email, email),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (existingInvite) {
    return fail("An invite is already pending for that email.", 409);
  }

  const token = randomUUID();
  const [invite] = await db
    .insert(invitations)
    .values({
      businessId: admin.businessId,
      email,
      role: body.role,
      token,
      status: "pending",
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      createdBy: admin.id,
    })
    .returning({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
    });

  await logActivity({
    businessId: admin.businessId,
    actorId: admin.id,
    action: "team.invite",
    entityType: "team",
    entityId: invite.id,
    metadata: { email: invite.email, role: invite.role },
  });

  return ok(
    { ...invite, inviteUrl: `${env.APP_URL}/invite/${token}` },
    201,
  );
});
