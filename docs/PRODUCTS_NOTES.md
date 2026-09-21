# Products / Plans catalog — API notes

Backend routes for the products/plans catalog. All routes:
- Run on the `nodejs` runtime.
- Are wrapped with `handler(...)` (consistent AuthError/ZodError/500 handling).
- Call `requireUser()` and scope every query to the caller's `businessId` (IDOR-safe).
- Treat money as integer minor units (`unitPrice`) — never floats.
- Filter out soft-deleted rows (`deletedAt is null`).

## Endpoints

### `GET /api/products`
List non-deleted products for the business.
- Query params:
  - `search` — case-insensitive `name` contains (`ILIKE %search%`).
  - `activeOnly=1` — restrict to `isActive = true`.
  - `sort` — `name` (A→Z) or default `createdAt` (newest first).
- Response: `{ data: { products: Product[] } }`

### `POST /api/products`
Create a product. Body validated with `productCreateSchema` (`name`, `description?`, `unitPrice`, `taxRateBps`).
- Sets `businessId`, `createdBy`, `updatedBy` from session.
- Response: `201 { data: Product }`

### `GET /api/products/[id]`
Fetch one product, scoped to business.
- `404` if not found / belongs to another business / soft-deleted.
- Response: `{ data: { product: Product } }`

### `PATCH /api/products/[id]`
Update a product. Body validated with `productUpdateSchema` (partial: `name`, `description`, `unitPrice`, `taxRateBps`, `isActive`).
- Archiving = normal PATCH with `isActive: false`.
- Only provided fields are written; sets `updatedBy` + `updatedAt`.
- `404` if not found / other business.
- Response: `{ data: Product }`

### `PATCH /api/products/[id]/delete`
Soft delete — sets `deletedAt = now()`. Scoped to business, `404` otherwise.
- No invoice-blocking check: line items are copied from products (never FK-linked),
  so deleting/archiving a product never affects past invoices.
- Response: `{ data: Product }`

## Response shape
Uses the shared `ok()`/`fail()` helpers from `src/lib/api.ts`:
- Success: `{ data: ... }`
- Error: `{ error: string, details?: unknown }` — `404` not found, `422` validation, `401` auth.

## Assumptions
- List returns all matching rows unscoped by pagination (spec did not request paging for
  products; unlike customers, the catalog is expected to be small). Easy to add later.
- Default sort is newest-first (`createdAt desc`); `?sort=name` gives alphabetical, matching
  the spec's "newest-or-name order".

## Frozen-file note (no changes made, flagged per instructions)
- `src/lib/activity.ts` — `ActivityAction` and `LogInput.entityType` unions do NOT include
  `product` values (e.g. `product.create`, `entityType: "product"`). The customers routes
  call `logActivity(...)`; the products routes intentionally OMIT audit logging because adding
  it would require editing that frozen file (out of scope) and would otherwise fail typecheck.
  If product audit logging is desired, add `product.create` / `product.delete` to `ActivityAction`
  and `"product"` to the `entityType` union in `src/lib/activity.ts`.
