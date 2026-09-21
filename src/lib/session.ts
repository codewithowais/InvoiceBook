import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
  businessId: string;
  isActive: boolean;
};

/**
 * Returns the signed-in user with a guaranteed businessId, or null.
 * Reads the fresh user row so role/businessId are always authoritative
 * (never trusts only the session token payload).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s?.user) return null;

  const [row] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, s.user.id))
    .limit(1);

  if (!row || !row.isActive || !row.businessId) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    businessId: row.businessId,
    isActive: row.isActive,
  };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** For route handlers: throws AuthError if not signed in. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new AuthError("Not authenticated", 401);
  return u;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.role !== "admin") throw new AuthError("Admin access required", 403);
  return u;
}
