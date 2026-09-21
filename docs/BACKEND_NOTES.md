# InvoiceBook — Backend Implementation Notes (Phase 1)

Implemented by the backend engineer. Covers the shared services, blob/PDF
helpers, and every Phase 1 API route. All money math goes through
`src/lib/money.ts`; all bodies are validated with `src/lib/validation.ts`;
every protected route calls `requireUser()`/`requireAdmin()` and scopes queries
by the caller's `businessId`.

## Shared services — `src/lib/invoice-service.ts`

- `nextInvoiceNumber(tx, businessId)` — `UPDATE businesses SET invoiceSeq = invoiceSeq + 1 ... RETURNING`, formats `${prefix}-${padStart(4)}`. Atomic per row.
- `finalizeInvoice(tx, invoiceId, user)` — draft-only; assigns number, sets `unpaid` + `finalizedAt`, writes `customerSnapshot` + `businessSnapshot` (jsonb).
- `recalcInvoiceStatus(tx, invoiceId)` — `amountPaid = sum(active payments)`; status paid / partially_paid / unpaid. A `void` invoice keeps its status (amountPaid still refreshed, never downgraded).
- `generateInvoiceFromPlan(tx, plan, user)` — builds a finalized `unpaid` invoice from a plan: `computeTotals` (no discount), items → `invoice_items`, `recurringPlanId` set, issue = `nextRunDate`, due = +30 days, snapshots frozen. Reuses `nextInvoiceNumber`.
- `runPlanCycle(tx, plan, user)` — generate + advance counters (`cyclesRun`, `lastRunDate`, `nextRunDate = addMonths(prev,1)`), sets `ended` when `endDate` passed or `cyclesRun >= maxCycles`. Used by both cron and generate-now.
- `runDueRecurringPlans(asOf)` — finds `active` plans with `nextRunDate <= asOf`, runs each in its own `db.transaction`; idempotent (nextRunDate only advances on a successful create). Returns `{ count, invoiceNumbers }`.

All multi-row writes run inside `db.transaction`.

## Blob helpers — `src/lib/blob.ts`

- `@vercel/blob@2.8.0` **supports private access** — proofs use `access: "private"`. Confirmed via the installed type defs (`BlobAccessType = 'public' | 'private'`).
- `uploadProof(file, businessId)` → private blob at `proofs/${businessId}/${uuid}-${filename}`, returns `{ blobKey (pathname), url, fileName, contentType }`.
- `signedProofUrl(blobKey, ttlMs=5min)` → two-step: `issueSignedToken({ pathname, operations:["get"], validUntil })` then `presignUrl(token, { operation:"get", access:"private", validUntil })`. Returns a short-lived URL.
- `uploadLogo(file, businessId)` → public blob at `logos/${businessId}/...`, returns `{ url }`.

## PDF — `src/lib/pdf.tsx`

- `@react-pdf/renderer` `renderToBuffer`. `renderInvoicePdf({ invoice, items, business, customer })` → `Buffer`.
- Layout: logo + business block (top-left), INVOICE + number/dates/status badge (top-right), Bill-To block, line-items table (desc/qty/unit/tax/total), totals (subtotal, discount, tax, grand total, paid/balance), notes + terms footer.
- The PDF route feeds it the jsonb snapshots when present, else live rows.

## Endpoints (all under `src/app/api/**`, wrapped with `handler()`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/dashboard | user | totalOutstanding, paidThisMonth, overdueCount, draftCount (aggregate SQL, scoped + deletedAt null) |
| GET | /api/business | user | business row |
| PATCH | /api/business | **admin** | update name/address/currency/prefix/logoUrl |
| POST | /api/uploads/logo | user | multipart; PNG/JPEG, ≤5MB; rate-limited per user |
| POST | /api/uploads/proof | user | multipart; PNG/JPEG/PDF, ≤10MB → 400 otherwise; private blob; rate-limited per user |
| GET | /api/customers | user | search (name/email), sort, page; computed outstanding + lastInvoiceDate |
| POST | /api/customers | user | Zod-validated create; businessId + createdBy from session |
| GET | /api/customers/[id] | user | customer + invoices + totals (billed/paid/outstanding) |
| PATCH | /api/customers/[id] | user | partial update; sets updatedBy; snapshots untouched |
| PATCH | /api/customers/[id]/delete | user | soft delete; 409 if non-void invoices exist |
| GET | /api/invoices | user | filter status (+ derived `overdue`), search (number/customer), sort (dueDate/total), page |
| POST | /api/invoices | user | draft; totals computed server-side; customer ownership verified; no number yet |
| GET | /api/invoices/[id] | user | invoice + items + payments (with signed proof URLs) + outstanding |
| PATCH | /api/invoices/[id] | user | **draft only** (409 otherwise); recomputes totals; replaces items in a tx |
| POST | /api/invoices/[id]/finalize | user | draft→unpaid in a tx via `finalizeInvoice` |
| GET | /api/invoices/[id]/pdf | user | streams `application/pdf` (snapshots preferred) |
| PATCH | /api/invoices/[id]/delete | **admin** | drafts anytime; finalized only when no active payments; soft delete |
| POST | /api/invoices/[id]/payments | user | Zod; tx locks invoice (`FOR UPDATE`), rejects amount > remaining (400), inserts payment, recalcs status; rate-limited per user |
| GET | /api/payments/[id]/proof | user | 302 redirect to signed URL; scoped via invoice→business |
| PATCH | /api/payments/[id]/void | user | tx: status=void + recalc invoice; scoped via invoice→business |
| GET | /api/recurring-plans | user | list plans + customer name |
| POST | /api/recurring-plans | **admin** | Zod; status active, nextRunDate=startDate; customer ownership verified |
| GET | /api/recurring-plans/[id] | user | one plan |
| PATCH | /api/recurring-plans/[id] | **admin** | edit template |
| POST | /api/recurring-plans/[id]/pause | **admin** | status=paused |
| POST | /api/recurring-plans/[id]/resume | **admin** | status=active; nextRunDate caught up to today if it drifted past |
| POST | /api/recurring-plans/[id]/generate | **admin** | runs one `runPlanCycle` immediately in a tx |
| GET | /api/cron/recurring | CRON_SECRET | `Authorization: Bearer ${CRON_SECRET}` else 401; runs `runDueRecurringPlans(new Date())` |

Route segment config: `runtime = "nodejs"` on all; `dynamic = "force-dynamic"` on dashboard, invoice detail, pdf, payment proof, and cron.

## Security decisions

- IDOR: every child resource (customer/invoice/payment/plan) is verified to belong to the caller's `businessId` before read/write. Payments and proofs are scoped by joining through the invoice.
- Never trust client totals — recomputed with `computeTotals` on create/update/finalize/generate.
- Finalized invoices reject edits (PATCH is draft-only, 409). Number + totals lock at finalize.
- Overpayment guarded at the route inside the row-locked transaction (`FOR UPDATE`), using the authoritative `sum(active payments)` rather than stored `amountPaid`.
- Upload type/size validated before hitting Blob.
- Rate limiting keyed per user id on both upload endpoints and payment recording.
- Recurring-generated invoices are attributed to `plan.createdBy` (FK-safe; the cron has no session), not a synthesized user id.

## Decisions / assumptions

- Logo upload requires a signed-in user (not strictly admin): the admin-only list in the spec names business PATCH but not the upload itself; the resulting URL is persisted via the admin-only business PATCH.
- Logo constraints (PNG/JPEG, ≤5MB) chosen since the spec only fixed proof constraints.
- `resume` recomputes `nextRunDate` to today when it had drifted into the past, avoiding a burst of back-filled invoices on the next cron.
- Recurring invoice due date = issue + 30 days (spec).

## Not touched / out of scope

- Phase 2/3 endpoints (team, email send, reports, reminders, activity log) not built.
- `src/app/api/auth/**` left as-is (Better Auth).

## Pre-existing type errors NOT caused by backend work (frontend-owned files)

`tsc --noEmit` reports two errors in files owned by the frontend engineer (I did
not touch them and am not permitted to):

1. `src/app/layout.tsx(2,20)` — `next/font/google` has no `Hanken_Grotesque`; should be `Hanken_Grotesk`.
2. `src/components/ui/input.tsx(7,18)` — `InputProps` re-declares `prefix` as `ReactNode`, incompatible with the DOM `prefix: string`.

All files owned by the backend engineer typecheck with zero errors.
