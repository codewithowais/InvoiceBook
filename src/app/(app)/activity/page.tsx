import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ActivityClient } from "@/components/activity/activity-client";

export const runtime = "nodejs";

/**
 * Activity — admin only. The (app) layout guarantees a signed-in user; here we
 * additionally gate on the admin role (non-admins are bounced to /dashboard).
 * All audit/trash data is fetched client-side from admin-guarded endpoints.
 */
export default async function ActivityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return <ActivityClient />;
}
