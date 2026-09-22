"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { apiGet, ApiError } from "@/lib/fetcher";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import {
  actionLabel,
  absoluteTime,
  relativeTime,
  ACTION_FILTER_OPTIONS,
  ENTITY_FILTER_OPTIONS,
  type ActivityFeed,
  type ActivityItem,
} from "@/components/activity/types";

const PAGE_LIMIT = 25;

/** Build a `/api/activity` query string from the current filters + page. */
function feedPath(page: number, action: string, entityType: string): string {
  const p = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
  if (action) p.set("action", action);
  if (entityType) p.set("entityType", entityType);
  return `/api/activity?${p.toString()}`;
}

/** Deep-link to the affected entity when we can address it. */
function entityHref(item: ActivityItem): string | null {
  if (!item.entityId) return null;
  if (item.entityType === "invoice") return `/invoices/${item.entityId}`;
  if (item.entityType === "customer") return `/customers/${item.entityId}`;
  return null;
}

/** A short, human detail line from the (schemaless) metadata blob. */
function metaSummary(item: ActivityItem): string | null {
  const m = item.metadata;
  if (!m || typeof m !== "object") return null;
  const parts: string[] = [];
  const num = m.number ?? m.invoiceNumber;
  if (typeof num === "string" && num) parts.push(num);
  if (typeof m.name === "string" && m.name) parts.push(m.name);
  if (typeof m.email === "string" && m.email) parts.push(m.email);
  if (typeof m.to === "string" && m.to) parts.push(m.to);
  if (typeof m.role === "string" && m.role) parts.push(m.role);
  const money = m.amount ?? m.total;
  if (typeof money === "number") {
    const currency = typeof m.currency === "string" ? m.currency : "USD";
    parts.push(formatMoney(money, currency));
  }
  return parts.length ? parts.join(" · ") : null;
}

export function ActivityFeedTab() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard against out-of-order responses when filters change quickly.
  const reqId = useRef(0);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      const id = ++reqId.current;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const data = await apiGet<ActivityFeed>(
          feedPath(nextPage, action, entityType),
        );
        if (id !== reqId.current) return;
        setItems(data.items);
        setPage(data.page);
        setHasMore(data.hasMore);
      } catch (err) {
        if (id !== reqId.current) return;
        setError(
          err instanceof ApiError
            ? err.message
            : "We couldn't load the activity log. Please try again.",
        );
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [action, entityType],
  );

  // (Re)load page 1 whenever a filter changes. This synchronises the component
  // with an external system (the API), the intended use of an effect here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(1, true);
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          aria-label="Filter by entity type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="h-9 sm:w-48"
        >
          <option value="">All types</option>
          {ENTITY_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-9 sm:w-60"
        >
          <option value="">All actions</option>
          {ACTION_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={3} />
      ) : error ? (
        <ErrorState description={error} onRetry={() => load(1, true)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No activity yet"
          description="Actions your team takes — creating, sending, paying, deleting — will appear here."
        />
      ) : (
        <>
          <ol className="divide-y divide-border">
            {items.map((item) => {
              const href = entityHref(item);
              const detail = metaSummary(item);
              const actor = item.actorName ?? item.actorEmail ?? "A teammate";
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-3"
                >
                  <span className="text-sm text-foreground">
                    <span className="font-medium">{actor}</span>{" "}
                    <span className="text-muted">{actionLabel(item.action)}</span>
                  </span>
                  {href ? (
                    <Link
                      href={href}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {detail ?? "View"}
                    </Link>
                  ) : detail ? (
                    <span className="text-sm text-foreground">{detail}</span>
                  ) : null}
                  <Badge variant="neutral" className="ml-auto shrink-0">
                    <time dateTime={item.createdAt} title={absoluteTime(item.createdAt)}>
                      {relativeTime(item.createdAt)}
                    </time>
                  </Badge>
                </li>
              );
            })}
          </ol>

          {page > 1 || hasMore ? (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loadingMore}
                onClick={() => load(page - 1, false)}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Previous
              </Button>
              <span className="text-xs font-medium text-muted-2">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore || loadingMore}
                onClick={() => load(page + 1, false)}
              >
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
