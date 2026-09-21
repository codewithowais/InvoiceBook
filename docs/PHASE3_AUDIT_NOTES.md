# Phase 3 — User Story 2: Audit Log + Trash/Restore

Admin-only audit trail plus a recoverable trash for soft-deleted records.
All queries and mutations are scoped to the caller's `businessId` (IDOR guard),
and every new endpoint (except the cron) requires `requireAdmin()`.

## 1. Activity logging points (add-only edits to existing routes)

`logActivity(...)` (from `src/lib/activity.ts`) is called **after** the primary
mutation commits, so logging can never change behavior or the response (the
helper also swallows its own errors). Actor = caller `user.id`, scoped to their
`businessId`.

| Route (file)                                         | Action                | entityType      | entityId            | metadata |
|------------------------------------------------------|-----------------------|-----------------|---------------------|----------|
| `POST /api/invoices`                                 | `invoice.create`      | `invoice`       | invoice id          | total, currency, customerId |
| `POST /api/invoices/[id]/finalize`                   | `invoice.finalize`    | `invoice`       | invoice id          | number, total |
| `POST /api/invoices/[id]/send`                       | `invoice.send`        | `invoice`       | invoice id          | to (recipient email) |
| `PATCH /api/invoices/[id]/delete`                    | `invoice.delete`      | `invoice`       | invoice id          | number, total |
| `POST /api/invoices/[id]/payments`                   | `payment.record`      | `payment`       | payment id          | invoiceId, invoiceNumber, amount, method |
| `PATCH /api/payments/[id]/void`                      | `payment.void`        | `payment`       | payment id          | invoiceId, invoiceNumber |
| `POST /api/customers`                                | `customer.create`     | `customer`      | customer id         | name, email |
| `PATCH /api/customers/[id]/delete`                   | `customer.delete`     | `customer`      | customer id         | name, email |
| `POST /api/recurring-plans`                          | `recurring.create`    | `recurring_plan`| plan id             | customerId, currency |
| `POST /api/recurring-plans/[id]/pause`               | `recurring.pause`     | `recurring_plan`| plan id             | customerId |
| `POST /api/recurring-plans/[id]/resume`              | `recurring.resume`    | `recurring_plan`| plan id             | customerId, nextRunDate |
| `POST /api/recurring-plans/[id]/generate`            | `recurring.generate`  | `recurring_plan`| plan id             | invoiceId, number |
| `POST /api/team/invite`                              | `team.invite`         | `team`          | invitation id       | email, role |
| `PATCH /api/team/[id]`                               | `team.update`         | `team`          | **null** (see note) | targetUserId, name, role, isActive |

**Note on `team.update`:** `activity_log.entityId` is a `uuid` column, but a team
member's id is a Better Auth **text** id (not a uuid). To avoid an invalid-uuid
insert, the target user id is stored in `metadata.targetUserId` and `entityId`
is left null. `team.invite` is fine because `invitations.id` is a uuid.
No secrets/tokens are ever written to metadata.

## 2. New endpoints

- **`GET /api/activity`** (admin) — paginated audit feed.
  Query: `page`, `limit` (default 25, max 100), optional `action`, optional
  `entityType`. Scoped to `businessId`, newest first, left-joined to `user` for
  actor name/email (left join so entries survive a deleted actor). Fetches
  `limit + 1` rows to derive `hasMore` without a count query.
  Returns `{ items, page, hasMore }`.

- **`GET /api/trash`** (admin) — soft-deleted invoices + customers + recurring
  plans (`deletedAt` not null) for the business. Each item carries `id`, `type`
  (`invoice` | `customer` | `recurring_plan`), `label`, `sublabel`, `currency`,
  `amount`, `deletedAt`, and a computed `purgeAt` (`deletedAt + 30 days`).
  Sorted by `deletedAt` desc. Returns `{ items, retentionDays }`.

- **`PATCH /api/invoices/[id]/restore`** (admin) — sets `deletedAt = null`,
  business-scoped, only if currently in trash. Logs `invoice.restore`.
- **`PATCH /api/customers/[id]/restore`** (admin) — sets `deletedAt = null`,
  business-scoped. Logs `customer.restore`.
- **`PATCH /api/recurring-plans/[id]/restore`** (admin) — sets `deletedAt = null`,
  business-scoped. **Not logged**: the `ActivityAction` union has no
  `recurring.restore`, and per the brief we don't force an ill-fitting action.

- **`GET /api/cron/purge-trash`** — Bearer `CRON_SECRET` (else 401), same pattern
  as `/api/cron/recurring`. The **only hard delete** in the system. Scheduled
  daily at 03:00 in `vercel.json` (already present).

## 3. Retention & purge behavior

- **Retention window: 30 days** (`TRASH_RETENTION_DAYS`, exported from
  `src/app/api/trash/route.ts` and reused by the cron).
- The purge hard-deletes rows whose `deletedAt < now − 30 days`.
- **FK-aware ordering:** `invoices.customerId → customers.id` has no
  `ON DELETE CASCADE`, so the cron purges in this order:
  1. **invoices** first (cascades to `invoice_items`, `payments`,
     `invoice_reminders` via their `onDelete: "cascade"` FKs);
  2. **recurring plans** (nothing references them via FK —
     `invoices.recurringPlanId` is a plain uuid column, not a FK);
  3. **customers**, but only those **no longer referenced** by any invoice or
     recurring plan (`NOT EXISTS` guards). A still-referenced customer stays in
     trash until its referencing rows age out too (eventually consistent), which
     keeps the delete safe without violating the FK.
- Returns `{ purged: { invoices, recurringPlans, customers }, cutoff }`.

## 4. Frontend — `/activity` page (admin)

- `src/app/(app)/activity/page.tsx` — server component; `getCurrentUser()` gate,
  redirects non-admins to `/dashboard` (mirrors the Team page). The admin
  "Activity" nav link already existed in the app shell (`/activity`).
- `src/components/activity/` (new, holds this feature's client + DTOs):
  - `types.ts` — DTOs + `actionLabel`/`relativeTime`/`absoluteTime`/`daysUntil`
    helpers and filter-option lists.
  - `tabs.tsx` — a small accessible tab control (WAI-ARIA tabs pattern: roving
    focus with arrow/Home/End keys, `role="tab"`/`aria-selected`,
    `aria-controls` → `role="tabpanel"`).
  - `activity-feed.tsx` — **Activity log** tab: reverse-chronological feed
    (actor, humanized action, deep link to invoice/customer where addressable,
    relative time with absolute `title`), filter by entity type + action,
    load-more pagination, and loading/empty/error states.
  - `trash-panel.tsx` — **Trash** tab: table of deleted items (type, when
    deleted, when it purges — highlighted when ≤ 3 days), Restore via
    `ConfirmDialog` + toast + optimistic drop then refetch.
  - `activity-client.tsx` — wires the two tabs together under a `PageHeader`.

## 5. Assumptions / notes

- **Add-only:** existing route logic and response shapes were not changed; only
  a `logActivity` import + call were appended to each handler.
- No frozen files (`src/db/**`, `src/lib/**`, `vercel.json`, settings/reminders)
  were edited. No schema change was required.
- The activity feed uses "one extra row" pagination (`limit + 1`) instead of a
  count, matching a simple load-more UX.
- Deep links in the feed point to `/invoices/[id]` and `/customers/[id]`; for a
  deleted entity these may 404, which is acceptable (the trash tab is the
  recovery path). Recurring plans have no standalone view route, so their feed
  rows are not linked.
