import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { invitations, user as userTable } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok } from "@/lib/api";

export const runtime = "nodejs";

/**
 * GET /api/team — admin only.
 * Lists every member of the caller's business (active + inactive) plus the
 * pending, non-expired invitations. Strictly scoped to the caller's
 * businessId so one business can never see another's team.
 */
export const GET = handler(async () => {
  const admin = await requireAdmin();

  const members = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      isActive: userTable.isActive,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(eq(userTable.businessId, admin.businessId))
    .orderBy(asc(userTable.createdAt));

  const invites = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.businessId, admin.businessId),
        eq(invitations.status, "pending"),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(invitations.createdAt));

  return ok({ members, invites });
});
