import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitors and load balancers.
 * 200 { status: "ok", db: "connected" } when the database is reachable,
 * 503 otherwise. No auth — safe to expose (reveals no data).
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json(
      { status: "ok", db: "connected", time: new Date().toISOString() },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { status: "error", db: "disconnected" },
      { status: 503 },
    );
  }
}
