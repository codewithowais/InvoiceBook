# InvoiceFlow — Backend Document (TRD)

Stack: Next.js App Router (route handlers), Neon Postgres, Drizzle ORM, Better Auth, Vercel Blob (private), React-PDF, Vercel Cron. Money is stored as integer minor units with a currency code. All list columns used in WHERE / ORDER BY / JOIN are indexed. Multi-row writes run inside a Drizzle transaction. Financial records are soft deleted with `deletedAt`. Zod validates every request body at the route boundary.

---

## Schemas

```
users {
  id: uuid pk,
  businessId: uuid ref to businesses,
  name: text,
  email: text unique,
  role: text (enum: admin, staff),
  isActive: bool default true,
  createdAt, updatedAt
}
// auth tables (account, session, verification) are managed by Better Auth

businesses {
  id: uuid pk,
  name: text,
  addressLine1, addressLine2, city, state, postalCode, country: text,
  logoUrl: text,                  // Vercel Blob url
  defaultCurrency: text default 'USD',   // ISO 4217
  invoicePrefix: text default 'INV',
  invoiceSeq: integer default 0,  // last used number, incremented atomically
  createdAt, updatedAt
}

customers {
  id: uuid pk,
  businessId: uuid ref to businesses,   // index
  name: text,
  email: text,
  phone: text,
  billingAddress: text,
  notes: text,
  deletedAt: timestamp null,      // soft delete
  createdBy: uuid ref to users,
  updatedBy: uuid ref to users,
  createdAt, updatedAt
}
// index on (businessId, deletedAt)

invoices {
  id: uuid pk,
  businessId: uuid ref to businesses,   // index
  customerId: uuid ref to customers,    // index
  recurringPlanId: uuid ref to recurring_plans null, // set when auto-generated
  number: text,                   // e.g. INV-0001, unique per business
  status: text (enum: draft, unpaid, partially_paid, paid, void),
  currency: text,
  issueDate: date,
  dueDate: date,                  // index (for overdue queries)
  subtotal: integer,              // minor units
  discountType: text (enum: none, flat, percent) default 'none',
  discountValue: integer default 0,   // minor units if flat, basis points if percent
  taxTotal: integer,
  total: integer,
  amountPaid: integer default 0,
  notes: text,
  terms: text,
  // snapshot of customer + business details at finalize time (immutability)
  customerSnapshot: jsonb,
  businessSnapshot: jsonb,
  finalizedAt: timestamp null,
  sentAt: timestamp null,         // Phase 2 email
  deletedAt: timestamp null,
  createdBy: uuid ref to users,
  updatedBy: uuid ref to users,
  createdAt, updatedAt
}
// unique index on (businessId, number)
// index on (businessId, status, dueDate)

invoice_items {
  id: uuid pk,
  invoiceId: uuid ref to invoices,      // index, onDelete cascade (child of invoice)
  description: text,
  quantity: integer,              // stored x1000 to allow fractional qty
  unitPrice: integer,             // minor units
  taxRateBps: integer default 0,  // basis points, e.g. 1750 = 17.5%
  lineSubtotal: integer,          // computed and stored
  lineTax: integer,
  lineTotal: integer,
  sortOrder: integer
}

payments {
  id: uuid pk,
  invoiceId: uuid ref to invoices,      // index
  amount: integer,                // minor units
  method: text (enum: bank_transfer, cash, cheque, card_offline, other),
  paidAt: date,
  reference: text,                // optional txn ref
  proofBlobKey: text,             // Vercel Blob pathname (private)
  proofFileName: text,
  proofContentType: text,
  status: text (enum: active, void) default 'active',
  createdBy: uuid ref to users,
  createdAt, updatedAt
}
// index on (invoiceId, status)

recurring_plans {
  id: uuid pk,
  businessId: uuid ref to businesses,   // index
  customerId: uuid ref to customers,
  status: text (enum: active, paused, ended) default 'active',
  cycle: text (enum: monthly) default 'monthly',
  startDate: date,
  endDate: date null,
  maxCycles: integer null,        // stop after N invoices
  cyclesRun: integer default 0,
  nextRunDate: date,              // index (cron scans this)
  lastRunDate: date null,
  autoEmail: bool default false,  // Phase 2
  // template payload
  currency: text,
  notes: text,
  terms: text,
  items: jsonb,                   // array of {description, quantity, unitPrice, taxRateBps}
  deletedAt: timestamp null,
  createdBy: uuid ref to users,
  updatedBy: uuid ref to users,
  createdAt, updatedAt
}
// index on (status, nextRunDate)

activity_log {   // Phase 3
  id: uuid pk,
  businessId: uuid,
  actorId: uuid,
  action: text,   // invoice.finalize, payment.record, payment.void, invoice.delete ...
  entityType: text,
  entityId: uuid,
  metadata: jsonb,
  createdAt
}
```

---

# Phase 1

### User Story 1 => Admin Onboarding Flow

1) Sign up api creates the first user and its business. (routes => POST /api/auth/sign-up handled by Better Auth + a post-hook)
   - on first user for a fresh business, create businesses row, set user.role = admin, set user.businessId
   - validate email + password strength with Zod
2) Get + update business settings api. (routes => GET /api/business, PATCH /api/business)
   - admin only for PATCH
   - accepts name, address fields, defaultCurrency, invoicePrefix
   - logo upload handled by blob upload api below
3) Dashboard summary api. (routes => GET /api/dashboard)
   - returns totalOutstanding, paidThisMonth, overdueCount, draftCount
   - single grouped SQL query, filtered by businessId and deletedAt is null

---

### User Story 2 => Staff Customer Flow

1) List customers api. (routes => GET /api/customers)
   - filter by businessId, deletedAt is null
   - support query params: search (name/email), sort, page
   - each row includes computed outstanding + lastInvoiceDate via join
2) Create customer api. (routes => POST /api/customers)
   - Zod: name required, email required + valid, phone optional
   - set businessId, createdBy from session
3) Get one customer with history. (routes => GET /api/customers/:id)
   - returns customer + invoices list + totals (billed, paid, outstanding)
4) Update customer api. (routes => PATCH /api/customers/:id)
   - set updatedBy
   - does not mutate snapshots on already-finalized invoices
5) Soft delete customer api. (routes => PATCH /api/customers/:id/delete)
   - block if customer has non-void invoices, else set deletedAt

---

### User Story 3 => Staff Invoice Create Flow

1) Create draft invoice api. (routes => POST /api/invoices)
   - Zod validates customerId, items[], dates, discount
   - status = draft, compute line + invoice totals server-side (never trust client totals)
   - number NOT assigned yet for drafts (assigned on finalize)
2) Update draft invoice api. (routes => PATCH /api/invoices/:id)
   - allowed only while status = draft
   - recompute all totals server-side
3) Finalize invoice api. (routes => POST /api/invoices/:id/finalize)
   - transaction:
     a) SELECT business FOR UPDATE, increment invoiceSeq atomically
     b) format number = prefix + zero-padded seq, ensure unique (businessId, number)
     c) set status = unpaid, finalizedAt = now
     d) write customerSnapshot + businessSnapshot (jsonb) so the invoice is immutable
   - after finalize, number and totals are locked
4) Get invoice detail api. (routes => GET /api/invoices/:id)
   - returns invoice + items + payments (with signed proof urls) + computed outstanding
5) Invoice PDF api. (routes => GET /api/invoices/:id/pdf)
   - render React-PDF server-side using the snapshots, stream application/pdf
6) Soft delete invoice api. (routes => PATCH /api/invoices/:id/delete)
   - admin only, drafts anytime, finalized only if no active payments; set deletedAt

---

### User Story 4 => Staff Record Payment Flow

1) Upload proof api. (routes => POST /api/uploads/proof)
   - accepts multipart, validate contentType in [image/png, image/jpeg, application/pdf], size <= 10MB → else 400
   - store to Vercel Blob as private, return { blobKey, fileName, contentType }
2) Record payment api. (routes => POST /api/invoices/:id/payments)
   - Zod: amount > 0, method enum, paidAt, blobKey required
   - transaction:
     a) lock the invoice row
     b) insert payment row (status active)
     c) recompute amountPaid = sum(active payments)
     d) set status: amountPaid >= total → paid; 0 < amountPaid < total → partially_paid; else unpaid
   - reject amount that exceeds remaining balance → 400
3) Signed proof url api. (routes => GET /api/payments/:id/proof)
   - generate short-lived signed url for the private blob, redirect or return url
4) Void payment api. (routes => PATCH /api/payments/:id/void)
   - transaction: set payment.status = void, recompute invoice amountPaid + status

---

### User Story 5 => Staff Invoice Tracking Flow

1) List invoices api. (routes => GET /api/invoices)
   - filter businessId, deletedAt is null
   - query params: status, search (number/customer), sort (dueDate|total), page
   - overdue is derived: status in (unpaid, partially_paid) AND dueDate < today
   - uses index (businessId, status, dueDate)

---

### User Story 6 => Admin Recurring Plan Flow

1) Create recurring plan api. (routes => POST /api/recurring-plans)
   - Zod validates customerId, items[], startDate, cycle=monthly, optional endDate/maxCycles
   - set status active, nextRunDate = startDate
2) List / get / update / pause / resume plan apis.
   - PATCH /api/recurring-plans/:id (edit template)
   - POST /api/recurring-plans/:id/pause  → status paused
   - POST /api/recurring-plans/:id/resume → status active, recompute nextRunDate
3) Generate now api (manual duplicate). (routes => POST /api/recurring-plans/:id/generate)
   - runs the same generation routine as the cron for this one plan immediately
4) Recurring generation routine (shared by cron + generate-now):
   a) find plan(s) where status = active AND nextRunDate <= today
   b) for each, in a transaction: create a finalized unpaid invoice from the plan template (reuse finalize sequence logic for number + snapshots), set invoice.recurringPlanId
   c) increment cyclesRun, set lastRunDate = nextRunDate
   d) compute nextRunDate = add 1 month; if endDate passed or cyclesRun >= maxCycles → status = ended
   e) (Phase 2) if autoEmail, enqueue invoice email

### Cron Jobs (Phase 1)

- Recurring invoice cron: runs daily at 02:00 UTC via Vercel Cron hitting `GET /api/cron/recurring` (protected by CRON_SECRET). Executes the recurring generation routine for all due active plans. Idempotent because nextRunDate advances only after a successful create.

---

# Phase 2

### User Story 1 => Admin Team Flow

1) Invite member api. (routes => POST /api/team/invite) — admin only, creates pending user + sends invite link.
2) Accept invite api. (routes => POST /api/team/accept) — sets password via Better Auth, activates user.
3) Update role / deactivate api. (routes => PATCH /api/team/:id) — admin only.

### User Story 2 => Staff Invoice Email Flow

1) Send invoice email api. (routes => POST /api/invoices/:id/send)
   - render PDF, send via email provider (marketplace integration), set sentAt.
   - Queue/email provider chosen via Vercel Marketplace at implementation time.

### User Story 3 => Admin Reporting Flow

1) Reports summary api. (routes => GET /api/reports?from&to) — grouped aggregates.
2) CSV export api. (routes => GET /api/reports/export) — streams text/csv.

---

# Phase 3

### User Story 1 => Admin Reminder Flow

1) Reminder settings api + reminder cron: daily scan for invoices near/over due, send email, log on invoice.

### User Story 2 => Admin Audit Flow

1) Activity log write on every mutating action; GET /api/activity list; trash + restore apis for soft-deleted records.

---

# Nice to have

- Multi-currency per customer: PATCH /api/customers/:id currency.
- Pay-online button on emailed invoices (needs payment provider).
- Customer portal: separate auth scope, read-only invoice + PDF access.
- Invoice templates: POST /api/templates — save/reuse line item sets.
