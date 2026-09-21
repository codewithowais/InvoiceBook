import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "staff", input: false },
      businessId: { type: "string", required: false, input: false },
      isActive: { type: "boolean", defaultValue: true, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  databaseHooks: {
    user: {
      create: {
        after: async (newUser) => {
          const u = newUser as typeof newUser & { businessId?: string | null };
          if (u.businessId) return;

          // Every new user starts as the admin of their own fresh business.
          // Invited members are re-homed to the inviting business ONLY by the
          // token-bound accept endpoint (/api/team/invite/[token]/accept) —
          // NEVER by matching an email here, which would let anyone who knows
          // an invited address join the business without the invite token.
          const [biz] = await db
            .insert(schema.businesses)
            .values({ name: `${newUser.name || "My"} Business` })
            .returning();
          await db
            .update(schema.user)
            .set({ businessId: biz.id, role: "admin" })
            .where(eq(schema.user.id, newUser.id));
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
