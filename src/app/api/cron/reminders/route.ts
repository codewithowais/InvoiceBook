import { handler, ok, fail } from "@/lib/api";
import { env } from "@/env";
import { runDueReminders } from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  // Protected by a shared secret, not a user session (invoked by Vercel Cron).
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return fail("Unauthorized", 401);
  }

  const result = await runDueReminders(new Date());
  return ok(result);
});
