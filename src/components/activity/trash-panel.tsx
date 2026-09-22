"use client";

import { useState } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { apiGet, apiPatch, ApiError } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  absoluteTime,
  daysUntil,
  trashTypeLabel,
  type TrashItem,
  type TrashList,
} from "@/components/activity/types";

const RESTORE_PATH: Record<TrashItem["type"], (id: string) => string> = {
  invoice: (id) => `/api/invoices/${id}/restore`,
  customer: (id) => `/api/customers/${id}/restore`,
  recurring_plan: (id) => `/api/recurring-plans/${id}/restore`,
};

export function TrashTab() {
  const { toast } = useToast();
  const { data, loading, error, refetch, setData } = useAsync<TrashList>(
    () => apiGet<TrashList>("/api/trash"),
    [],
    "/api/trash",
  );

  const [target, setTarget] = useState<TrashItem | null>(null);
  const [busy, setBusy] = useState(false);

  const items = data?.items ?? [];
  const retentionDays = data?.retentionDays ?? 30;

  async function restore() {
    if (!target) return;
    const item = target;
    setBusy(true);
    try {
      await apiPatch(RESTORE_PATH[item.type](item.id));
      // Optimistically drop the row, then refetch to reconcile.
      if (data) {
        setData({
          ...data,
          items: data.items.filter(
            (i) => !(i.id === item.id && i.type === item.type),
          ),
        });
      }
      toast({
        variant: "success",
        title: `${trashTypeLabel(item.type)} restored`,
        description: item.label,
      });
      setTarget(null);
      refetch();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't restore",
        description: err instanceof ApiError ? err.message : undefined,
      });
      setTarget(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-[0.9375rem] font-semibold text-foreground">
          Deleted items
        </h2>
        <p className="text-xs text-muted-2">
          Purged automatically after {retentionDays} days
        </p>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : error ? (
        <ErrorState description={error} onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          description="Deleted invoices, customers and recurring plans show up here and can be restored before they're purged."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Item</TH>
              <TH>Type</TH>
              <TH>Deleted</TH>
              <TH>Purges</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((item) => {
              const days = daysUntil(item.purgeAt);
              const rowBusy = busy && target?.id === item.id;
              return (
                <TR key={`${item.type}:${item.id}`}>
                  <TD>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {item.label}
                      </p>
                      {item.sublabel ? (
                        <p className="truncate text-xs text-muted-2">
                          {item.sublabel}
                        </p>
                      ) : null}
                      {item.amount != null ? (
                        <p className="text-xs text-muted-2">
                          {formatMoney(item.amount, item.currency ?? "USD")}
                        </p>
                      ) : null}
                    </div>
                  </TD>
                  <TD>
                    <Badge variant="neutral">{trashTypeLabel(item.type)}</Badge>
                  </TD>
                  <TD>
                    <time
                      dateTime={item.deletedAt}
                      title={absoluteTime(item.deletedAt)}
                      className="text-muted"
                    >
                      {formatDate(item.deletedAt)}
                    </time>
                  </TD>
                  <TD>
                    <Badge variant={days <= 3 ? "warning" : "neutral"}>
                      {days === 0
                        ? "Due"
                        : `in ${days} day${days === 1 ? "" : "s"}`}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={rowBusy}
                      onClick={() => setTarget(item)}
                    >
                      <RotateCcw className="size-4" aria-hidden />
                      Restore
                    </Button>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={restore}
        title={`Restore this ${target ? trashTypeLabel(target.type).toLowerCase() : "item"}?`}
        description={
          target
            ? `"${target.label}" will be moved out of trash and become active again.`
            : undefined
        }
        confirmLabel="Restore"
        variant="primary"
      />
    </Card>
  );
}
