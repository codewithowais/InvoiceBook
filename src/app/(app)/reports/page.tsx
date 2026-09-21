import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ReportsClient } from "@/components/reports/reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Reporting is admin-only; staff are sent back to their dashboard.
  if (user.role !== "admin") redirect("/dashboard");

  return <ReportsClient />;
}
