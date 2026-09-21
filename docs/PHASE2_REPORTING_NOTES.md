# Phase 2 — User Story 3: Admin Reporting

Implementation notes for the Reporting feature. Built to match existing
InvoiceBook patterns (dashboard route, `handler`/`ok`, `requireAdmin`,
businessId scoping, the UI Card/Table/PageHeader primitives and design tokens).

## Files added (all within the owned surface)

Backend
- `src/app/api/reports/route.ts` — `GET /api/reports?from&to` (admin)
- `src/app/api/reports/export/route.ts` — `GET /api/reports/export?from&to` (admin)

Frontend
- `src/app/(app)/reports/page.tsx` — server component, admin-only gate
- `src/components/reports/reports-client.tsx` — orchestrator (cards, status, customers, states)
- `src/components/reports/report-chart.tsx` — inline-SVG grouped bar chart
- `src/components/reports/date-range-control.tsx` — preset + custom date range
- `src/components/reports/range.ts` — preset → {from,to} helpers (pure)
- `src/components/reports/types.ts` — `ReportSummary` DTOs (kept out of frozen `src/lib/types.ts`)

No frozen files were modified. `reportRangeSchema` already existed in
`src/lib/validation.ts`; the "Reports" nav link already existed in the
app-shell. Nothing needed to change there.

## Endpoints

### `GET /api/reports?from&to`
Admin-only (`requireAdmin`). Query validated with `reportRangeSchema`; `from`/`to`
are `YYYY-MM-DD`. Missing/invalid dates default to the **last 12 months**
(first day of the month 11 months ago → today). An inverted range is swapped.
All queries are scoped to `user.businessId` and exclude `deletedAt`.

Response (`data`):
```jsonc
{
  "range": { "from": "2025-10-01", "to": "2026-09-21" },
  "totals": {
    "billed":      // Σ finalized invoice totals, issueDate in range
    "collected":   // Σ ACTIVE payments, paidAt in range
    "outstanding": // Σ (total - amountPaid) for unpaid/partially_paid — current AR, NOT time-bounded
    "currency":    // business.defaultCurrency
  },
  "monthly": [ { "month": "YYYY-MM", "billed": n, "collected": n } ], // gap-filled, chronological
  "byStatus": [ { "status": "unpaid|partially_paid|paid|void|overdue", "count": n, "total": n } ],
  "byCustomer": [ { "customerId", "name", "billed", "collected", "outstanding" } ] // top 10 by billed
}
```

"Finalized" = status in `('unpaid','partially_paid','paid')` (excludes `draft`
and `void`). Money is integer minor units throughout.

Query strategy (set-based, no N+1): one invoices aggregate scan (billed +
outstanding + overdue count/total via CASE sums), one payments aggregate
(collected), two grouped scans for the monthly series (`to_char(date,'YYYY-MM')`),
one `GROUP BY status`, and two grouped scans for the customer table (invoices
billed/outstanding + payments collected), merged in JS and sliced to 10.

### `GET /api/reports/export?from&to`
Admin-only. Same range handling. Streams `text/csv` (`ReadableStream`) with
`Content-Disposition: attachment; filename="invoiceflow-report-<from>-<to>.csv"`.
Invoice-level rows for invoices with `issueDate` in range (non-deleted, excludes
drafts; `void` kept for the accountant's record), ordered by issue date then
number. Columns: Invoice number, Customer, Status, Issue date, Due date,
Currency, Total, Amount paid, Outstanding. Money is converted from minor units
to a plain 2-dp decimal string (no symbol). Fields are RFC-4180 escaped
(quoted + doubled quotes when they contain `" , \r \n`).

## Frontend

- Server page reads `getCurrentUser()`; unauthenticated → `/login`, non-admin →
  `/dashboard`.
- Date-range control: preset selector (This month / Last 3 months / This year /
  Last 12 months / Custom). Custom reveals two labelled `<input type="date">`
  fields. Any change updates state and refetches (via `useAsync` deps).
- Stat cards: Total billed, Total collected, Outstanding (AR) — all via `formatMoney`.
- Export CSV: a real `<a href download>` to the export route styled with
  `buttonClasses` (cookie session travels with the request).
- Loading (Skeleton), empty ("No data in this range"), and error (ErrorState
  with retry) states are all handled.

## Chart approach (dataviz method)

Month-by-month **grouped bar chart**, billed vs collected, hand-built as inline
SVG (no chart library). Responsive `viewBox` (`760×320`, `preserveAspectRatio`),
recessive gridlines/axis using the app's `--border`/`--border-strong`/`--muted`
tokens, 4px rounded bar tops anchored to the baseline, a 2px surface gap between
each pair, a legend, an HTML hover tooltip, a "View as table" disclosure, and
`role="img"` + `<title>`/`<desc>` for screen readers.

Colours are a **validated two-series categorical pair** (brand-sympathetic jade +
copper, re-stepped per theme so they pass every gate — the raw app `--primary`/
`--accent` tokens fail the chroma/lightness/CVD checks as a categorical pair):

| Theme | Billed (teal) | Collected (copper) | Result |
|-------|---------------|--------------------|--------|
| Light (surface `#ffffff`) | `#0e8a6f` | `#c96a1f` | all checks PASS, CVD ΔE 9.2 |
| Dark (surface `#121815`)  | `#1f9a80` | `#c8763a` | all checks PASS |

Verified with the dataviz `validate_palette.js` script in both `--mode light`
and `--mode dark` against the actual chart surfaces. Series colours are defined
as CSS custom properties scoped to the chart, redefined under both
`prefers-color-scheme: dark` (guarded against a manual light choice) and
`[data-theme="dark"]`. Identity is never colour-alone: legend + tooltip + table.

## Assumptions

- **`byStatus` is a current book snapshot** (not range-bounded), pairing with the
  current-AR `outstanding` figure; it excludes drafts and includes `void`.
- **`overdue` in `byStatus` is a derived subset** of unpaid/partially_paid past
  their due date — it intentionally overlaps those buckets (aging view), it is
  not a mutually-exclusive status.
- **`byCustomer` is ranked by `billed` in range**; `collected` is range-bound
  (by `paidAt`) and `outstanding` is current AR. Customers with zero activity in
  scope are dropped; top 10 returned.
- Single business currency assumed (`business.defaultCurrency`) for formatting,
  per the brief.
- CSV export excludes drafts (not real billed documents) and soft-deleted rows;
  `void` invoices are included for completeness.

## Verification

- `corepack pnpm exec tsc --noEmit` → 0 errors.
- `corepack pnpm exec eslint` on the new files → clean.
- Palette validated with the dataviz script (light + dark). Not run against a
  live DB (no DB available; `pnpm dev` not run per brief).
