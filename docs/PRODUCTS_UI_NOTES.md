# Products / Plans catalog UI + responsive pass — build notes

Two jobs: (A) build the Products/Plans catalog UI and line-item pickers, and
(B) a responsive sweep across the app. `tsc --noEmit` is clean and
`pnpm run build` succeeds.

## Part A — Products UI

### New files

- **`src/app/(app)/products/page.tsx`** — the Products catalog page.
  - Searchable list (server `?search=`, 300ms debounce via `useDebounced`)
    with a client-side segmented status filter: **All / Active / Archived**.
    The list endpoint returns all non-deleted products (active + archived), so
    the filter is applied client-side for instant switching without a refetch.
  - Columns: product (name + truncated description), flat **monthly** price via
    `formatMoney(unitPrice, currency)` with a `/mo` suffix, tax % (`taxRateBps/100`),
    and an Active/Archived `Badge`. Archived rows are dimmed.
  - "New product" and row-click both open the shared dialog (edit on row click).
  - Full loading (`TableSkeleton`), empty (search vs. first-run), and error
    (`ErrorState` + retry) states; toasts on every mutation.
  - Archive uses `PATCH /api/products/[id]` `{ isActive:false }` behind a
    `ConfirmDialog`; un-archive is a one-click `{ isActive:true }` PATCH.

- **`src/components/products/product-form-dialog.tsx`** — create/edit dialog
  (mirrors `customer-form-dialog.tsx`). Fields: name (required), description
  (optional), monthly price (user types a decimal → `toMinor` before sending),
  tax % (→ basis points). Client-side validation mirrors `productCreateSchema`
  (name 1–160, description ≤1000, unitPrice ≥0, tax 0–1000% i.e. bps ≤100000),
  plus it maps server 422 `fieldErrors` back onto the form. Edit prefills with
  `fromMinor(unitPrice)` and `taxRateBps/100`. Uses `POST /api/products` and
  `PATCH /api/products/[id]`.

- **`src/components/products/product-picker.tsx`** — reusable "Add from
  products" control. A `Button` opens a `Dialog` (so focus-trap, Esc-to-close
  and focus restoration come for free / WCAG-AA). Body fetches active products
  via `GET /api/products?activeOnly=1` (fetched lazily, only while the dialog is
  open), with an in-dialog search box (client-side filter). Each product is a
  keyboard-focusable `<button>`; selecting one calls
  `onPick({ description: name, quantity: 1000, unitPrice, taxRateBps })`
  (stored units — qty ×1000) and closes. Loading / error / empty states; the
  empty state links to `/products`. Exports the `PickedProduct` type.

### Picker integration points

- **`src/components/invoices/invoice-editor.tsx`**
- **`src/components/recurring/plan-editor.tsx`**

Both now render `<ProductPicker onPick={addFromProduct} />` via the new
`extraAction` slot on `LineItemsEditor` (placed next to "Add line item").
`addFromProduct` converts the picked product to an editor row with the existing
`itemFromStored` helper, then **fills the first empty line** (blank description
+ blank unit price) or **appends** a new one. Line items stay fully editable and
totals recompute normally — products are never FK-linked.

`LineItemsEditor` gained an optional `extraAction?: React.ReactNode` prop; the
"Add line item" button and the extra action share a `flex flex-wrap` row.

## Part B — Responsive fixes (375 / 768 / 1024+, no horizontal page scroll)

- **Line-items editor overflow (the known bug).** `src/components/invoices/line-items-editor.tsx`:
  the `md`+ table-like grid has a fixed minimum width, which previously forced
  the editor's `1fr` column — and therefore the page — wider than the viewport,
  pushing the summary sidebar off-screen. Fixed by wrapping the desktop grid in
  its own `md:overflow-x-auto` container with `md:min-w-[42rem]`, so it scrolls
  **inside its card** instead. The mobile (<md) stacked, labeled card layout is
  unchanged.
- **Editor / detail sidebar layout.** Changed the three
  `lg:grid-cols-[1fr_20rem]` layouts to `lg:grid-cols-[minmax(0,1fr)_20rem]` and
  added `min-w-0` to the left column so the main column can shrink and never
  clips or shoves the summary sidebar. Files: `invoice-editor.tsx`,
  `recurring/plan-editor.tsx`, `invoices/[id]/page.tsx`. Below `lg` the sidebar
  stacks under the form as before.
- **Products page toolbar.** Search + status filter wrap gracefully
  (`flex-col sm:flex-row`), and the filter chips use `flex-wrap`.
- **Settings sticky save bar.** Added `flex-wrap` so the "Ready to apply
  changes?" label + button wrap instead of overflowing at 375px.

### Audited and already fine (no change needed)

- Wide data tables (invoices, customers, activity, products, reports, team,
  invoice detail line items) already render through the shared `Table` primitive
  (`src/components/ui/table.tsx`), which wraps every table in
  `w-full overflow-x-auto` — they scroll within their container.
- Dashboard / reports stat-card grids (`grid-cols-1 sm:grid-cols-2/3 xl:grid-cols-4`)
  and report month/status/customer grids collapse correctly at small widths.
- `Dialog` already caps height (`max-h-[92dvh]`), scrolls its body internally,
  and uses a 16px side gutter (`sm:p-4`, full-width sheet on mobile).
- The reports bar chart is inline SVG with a scaling `viewBox`, and its
  "View as table" fallback is wrapped in `overflow-x-auto`.

## Constraints honored

- Money always via `formatMoney(minor, currency)`; inputs convert with `toMinor`
  / basis points before sending. Quantities use the ×1000 stored scale.
- No edits to `src/db/**`, `src/lib/**` (read-only), `src/app/api/**`, or auth.
- Token-based styling throughout; the theme was not restyled.
