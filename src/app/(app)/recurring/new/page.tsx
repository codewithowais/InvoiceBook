import { PlanEditor } from "@/components/recurring/plan-editor";

export const metadata = { title: "New recurring plan" };

export default function NewRecurringPlanPage() {
  return <PlanEditor mode="create" />;
}
