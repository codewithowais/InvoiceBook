"use client";

import { useParams } from "next/navigation";
import { apiGet } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import type { RecurringPlan, RecurringPlanDetail } from "@/lib/types";
import { PlanEditor } from "@/components/recurring/plan-editor";
import { Card } from "@/components/ui/card";
import { LoadingBlock } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";

/** Accepts either a bare plan or a `{ plan }` detail wrapper from the API. */
function unwrapPlan(res: RecurringPlan | RecurringPlanDetail): RecurringPlan {
  return "plan" in res ? res.plan : res;
}

export default function EditRecurringPlanPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, loading, error, refetch } = useAsync<RecurringPlan>(async () => {
    const res = await apiGet<RecurringPlan | RecurringPlanDetail>(
      `/api/recurring-plans/${id}`,
    );
    return unwrapPlan(res);
  }, [id], `plan:${id}`);

  if (loading)
    return (
      <Card>
        <LoadingBlock label="Loading plan…" />
      </Card>
    );
  if (error)
    return (
      <Card>
        <ErrorState description={error} onRetry={refetch} />
      </Card>
    );
  if (!data) return null;

  return <PlanEditor mode="edit" plan={data} />;
}
