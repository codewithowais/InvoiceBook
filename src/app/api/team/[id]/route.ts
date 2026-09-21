import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { teamMemberUpdateSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/team/[id] — admin only.
 * Change a member's role and/or active flag within the caller's business.
 * Guardrails:
 *  - a user cannot change their OWN role or deactivate themselves (409)
 *  - the LAST remaining active admin can never be demoted or deactivated (409)
 *  - strictly scoped to the caller's businessId (IDOR)
 */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const body = teamMemberUpdateSchema.parse(await req.json());

  // Nothing to change.
  if (body.role === undefined && body.isActive === undefined) {
    return fail("Provide a role or active status to update.", 400);
  }

  // Load the target, scoped to the caller's business (prevents IDOR).
  const [member] = await db
    .select({
      id: userTable.id,
      role: userTable.role,
      isActive: userTable.isActive,
    })
    .from(userTable)
    .where(
      and(eq(userTable.id, id), eq(userTable.businessId, admin.businessId)),
    )
    .limit(1);

  if (!member) return fail("Team member not found", 404);

  const isSelf = member.id === admin.id;
  const nextRole = body.role ?? member.role;
  const nextActive = body.isActive ?? member.isActive;

  // Self-guard: can't change own role or deactivate yourself.
  if (isSelf) {
    if (body.role !== undefined && body.role !== member.role) {
      return fail("You cannot change your own role.", 409);
    }
    if (body.isActive === false) {
      return fail("You cannot deactivate yourself.", 409);
    }
  }

  // Last-admin guard: if this change removes the target from the set of active
  // admins, make sure at least one active admin remains.
  const wasActiveAdmin = member.role === "admin" && member.isActive;
  const willBeActiveAdmin = nextRole === "admin" && nextActive;
  if (wasActiveAdmin && !willBeActiveAdmin) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userTable)
      .where(
        and(
          eq(userTable.businessId, admin.businessId),
          eq(userTable.role, "admin"),
          eq(userTable.isActive, true),
          ne(userTable.id, member.id),
        ),
      );
    if (count === 0) {
      return fail("At least one admin is required.", 409);
    }
  }

  const [updated] = await db
    .update(userTable)
    .set({
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(eq(userTable.id, id), eq(userTable.businessId, admin.businessId)),
    )
    .returning({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      isActive: userTable.isActive,
      createdAt: userTable.createdAt,
    });

  // Note: the team member id is a Better Auth text id, not a uuid, so it is
  // recorded in metadata rather than entityId (which is a uuid column).
  await logActivity({
    businessId: admin.businessId,
    actorId: admin.id,
    action: "team.update",
    entityType: "team",
    metadata: {
      targetUserId: updated.id,
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
    },
  });

  return ok(updated);
});
