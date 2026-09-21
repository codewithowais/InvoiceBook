import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";
import { env } from "@/env";

// Neon's serverless driver needs a WebSocket implementation in Node.
// Node 22+ ships a global WebSocket; fall back to `ws` otherwise.
if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

type Db = NeonDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: Db;
};

/**
 * Lazily construct the pool + drizzle instance on first use. This means
 * `next build` (which never runs a query) never reads DATABASE_URL, so the
 * app builds without a database configured; the env var is only required at
 * request time when a query actually runs.
 */
function getDb(): Db {
  if (globalForDb.db) return globalForDb.db;
  const pool =
    globalForDb.pool ?? new Pool({ connectionString: env.DATABASE_URL });
  const instance = drizzle(pool, { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.pool = pool;
    globalForDb.db = instance;
  }
  return instance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDb();
    const value = instance[prop as keyof Db];
    return typeof value === "function" ? value.bind(instance) : value;
  },
}) as Db;

export { schema };
