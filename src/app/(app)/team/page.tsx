import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { TeamClient } from "@/components/team/team-client";

export const runtime = "nodejs";

/**
 * Team settings — admin only. The (app) layout already guarantees a signed-in
 * user; here we additionally gate on the admin role and hand the current
 * user's id to the client so it can flag "This is you" on their own row.
 */
export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return <TeamClient currentUserId={user.id} />;
}
