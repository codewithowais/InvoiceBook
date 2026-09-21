import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, user as userTable } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok } from "@/lib/api";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * GET /api/activity — admin only.
 * Paginated audit feed scoped to the caller's business, newest first, with the
 * actor's name/email joined in (left join so entries survive a deleted user).
 * Optional `action` / `entityType` filters. Returns `{ items, page, hasMore }`.
 */
export const GET = handler(async (req: Request) => {
  const user = await requireAdmin();
  const url = new URL(req.url);

  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
  );
  const action = url.searchParams.get("action")?.trim();
  const entityType = url.searchParams.get("entityType")?.trim();

  const filters = [eq(activityLog.businessId, user.businessId)];
  if (action) filters.push(eq(activityLog.action, action));
  if (entityType) filters.push(eq(activityLog.entityType, entityType));

  // Fetch one extra row to determine `hasMore` without a separate count query.
  const rows = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      metadata: activityLog.metadata,
      createdAt: activityLog.createdAt,
      actorId: activityLog.actorId,
      actorName: userTable.name,
      actorEmail: userTable.email,
    })
    .from(activityLog)
    .leftJoin(userTable, eq(activityLog.actorId, userTable.id))
    .where(and(...filters))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit + 1)
    .offset((page - 1) * limit);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return ok({ items, page, hasMore });
});
