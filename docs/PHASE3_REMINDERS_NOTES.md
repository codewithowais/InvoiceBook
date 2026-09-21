# Phase 3 — User Story 1: Payment Reminders

Admin-controlled payment reminders. The tool emails customers a polite reminder
a set number of days before an invoice's due date, and again on a repeating
schedule once it becomes overdue. Every reminder is recorded on the invoice
(`invoice_reminders` rows) so the team can see what was sent, and those rows are
the idempotency guard against double-sends.

## Endpoints

### `GET /api/reminders/settings` (admin)
Returns the caller's business reminder settings (scoped to `businessId`):
`{ reminderEnabled, reminderDaysBefore, overdueReminderEnabled, overdueReminderEveryDays, maxReminders }`.

### `PATCH /api/reminders/settings` (admin)
Validates the body with `reminderSettingsSchema` (`src/lib/validation.ts`),
updates the caller's business, and writes an activity-log entry
(`logActivity`, action `settings.update`, entityType `business`). Returns the
updated 5 fields.

Ranges (from `reminderSettingsSchema`):
- `reminderDaysBefore`: integer 0–60
- `overdueReminderEveryDays`: integer 1–90
- `maxReminders`: integer 1–20

### `GET /api/cron/reminders`
Vercel Cron endpoint (scheduled daily at 08:00 in `vercel.json`). Requires
`Authorization: Bearer ${CRON_SECRET}` — mirrors `src/app/api/cron/recurring`
exactly; returns 401 otherwise. Runs `runDueReminders(new Date())` and returns
`{ before, overdue, errors }`.

## Reminder cadence logic — `src/lib/reminders.ts` `runDueReminders(asOf)`

1. Load every business with `reminderEnabled` **OR** `overdueReminderEnabled`.
2. For each, load its invoices with status in (`unpaid`, `partially_paid`) and
   `deletedAt IS NULL`, plus that business's full `invoice_reminders` history
   (indexed per invoice, one query per business).
3. "Today" is derived from `asOf` via `toISODate` (UTC day, consistent with the
   recurring cron). Due dates are day-precision (`date` column). Day math is
   done at UTC midnight.

**before_due** — when `business.reminderEnabled`:
- Fires when `today === dueDate − reminderDaysBefore` (i.e. `daysUntilDue ===
  reminderDaysBefore`), and there is **no** existing `before_due` row for the
  invoice. Sent at most once per invoice.

**overdue** — when `business.overdueReminderEnabled` and `today > dueDate`
(`daysOverdue ≥ 1`):
- If no overdue row exists yet → send the first one.
- Otherwise → send only once at least `overdueReminderEveryDays` calendar days
  have passed since the most recent overdue row's `sentAt`.
- Capped at `maxReminders` total overdue reminders per invoice.

**Each send:**
- Builds the invoice PDF via `buildInvoicePdfForBusiness(invoiceId, businessId)`
  (reused; also yields the customer email + business name).
- If the customer has **no email**, the invoice is skipped and **nothing is
  recorded** (no row, not counted, no error).
- Otherwise emails via `sendMail` (dev = free Ethereal preview) with a clear
  reminder subject/body: business name, invoice number, amount outstanding
  (`total − amountPaid` via `formatMoney`), due date; the PDF is attached.
- Inserts an `invoice_reminders` row (`kind` = `before_due` | `overdue`).

**Resilience / idempotency:**
- Each send is wrapped in try/catch; a single failure is collected into
  `errors` and never aborts the run.
- `invoice_reminders` rows are the guard — the same reminder is never sent
  twice (before_due once ever; overdue gated by count + interval).

## Frontend

`src/components/settings/reminder-settings.tsx` — admin-only "Payment reminders"
card added to `src/app/(app)/settings/page.tsx` (rendered as a sibling **below**
the existing business-settings form, not nested inside it, to avoid invalid
nested `<form>` elements). Loads via `GET /api/reminders/settings`, saves via
`PATCH`, with client validation mirroring `reminderSettingsSchema`, plus
loading / disabled / toast states. Reuses existing UI primitives (Card, Field,
Input, Button, native checkbox pattern matching `plan-editor.tsx`). The existing
business-settings section is unchanged.

## Security / correctness notes

- IDOR: every query is scoped to `user.businessId` from the session; the client
  never supplies a business id. `requireAdmin` gates both settings verbs.
- Reminders only ever email the invoice's own customer (from the PDF builder's
  customer snapshot / live row) — never an address from the request.
- The cron is protected by the shared `CRON_SECRET` bearer token, not a user
  session.

## Assumptions

- "Today" uses the UTC calendar day (`toISODate`), matching the existing
  recurring cron's date handling. If the deployment's business day differs from
  UTC this could shift a reminder by a day; acceptable and consistent with the
  rest of the codebase.
- Draft/void invoices are never reminded (status filter is `unpaid` /
  `partially_paid` only). Open invoices are always finalized, so a customer
  snapshot/email is available via the PDF builder.
- No frozen files were edited. No changes to `schema.ts`, `vercel.json`, or any
  audit-agent-owned routes were required.
