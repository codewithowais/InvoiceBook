# InvoiceBook

A modern invoicing tool for a small team: create invoices, track payments manually with **proof-of-payment attachments**, and run **monthly recurring billing** that generates invoices automatically. Built for one business with Admin / Staff roles.

> Product spec: [`docs/PRD.md`](docs/PRD.md) · Technical spec: [`docs/BACKEND.md`](docs/BACKEND.md) · Backend decisions: [`docs/BACKEND_NOTES.md`](docs/BACKEND_NOTES.md)

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 (custom "financial ledger" design system, light + dark) |
| Database | Neon Postgres via Drizzle ORM |
| Auth | Better Auth (email + password, DB sessions, roles) |
| Files | Vercel Blob — **private** proof storage, signed URLs |
| PDF | `@react-pdf/renderer` (server-rendered invoices) |
| Recurring | Vercel Cron → daily generation job |
| Hosting | Vercel |

**Money is stored as integer minor units (cents); quantities x1000; tax in basis points — never floats.**

## Getting started

This machine uses **pnpm via corepack** (no global `npm`). Run Node from Homebrew:

```bash
export PATH="/usr/local/opt/node/bin:$PATH"
```

### 1. Configure environment

`.env.local` already has generated `BETTER_AUTH_SECRET` and `CRON_SECRET`. Fill in the two account-specific values:

- **`DATABASE_URL`** — create a free project at [console.neon.tech](https://console.neon.tech) and paste the *pooled* connection string.
- **`BLOB_READ_WRITE_TOKEN`** — Vercel dashboard → Storage → Blob → create a store → copy the token.

### 2. Create the database tables

```bash
corepack pnpm db:migrate
```

(or `corepack pnpm db:push` to push the schema directly during development.)

### 3. Run it

```bash
corepack pnpm dev
```

Open http://localhost:3000, click **Sign up** — the first account automatically becomes the **Admin** and creates your business. Fill in business settings, add a customer, create your first invoice.

### 4. (Optional) Load demo data

After signing up:

```bash
corepack pnpm db:seed
```

Adds two sample customers, an unpaid invoice, and a monthly recurring plan.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Generate a new migration from schema changes |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:push` | Push schema directly (dev) |
| `pnpm db:studio` | Drizzle Studio (browse data) |
| `pnpm db:seed` | Seed demo data (sign up first) |

## Recurring billing

A daily Vercel Cron (`vercel.json` → `0 2 * * *`) calls `GET /api/cron/recurring`, protected by `CRON_SECRET`. It finds active plans whose `nextRunDate` has arrived and generates the next finalized invoice. You can also click **Generate now** on any plan for a manual cycle.

## Roadmap

- **Phase 1 (built):** onboarding, customers, invoices, manual payments + proof, tracking, recurring plans.
- **Phase 2 (built):** team invites with roles (token-bound accept), invoice email (PDF attached) + recurring auto-email, reporting dashboard + CSV export.
- **Phase 3 (built):** payment reminders (before-due + overdue cadence), activity/audit log, trash with restore + 30-day auto-purge.

See [`docs/PRD.md`](docs/PRD.md) for the full phased plan.

### Payment reminders (Phase 3)

In **Settings → Payment reminders** (admin), enable a reminder a set number of days before the due date and/or recurring overdue reminders (every N days, capped). A daily cron (`/api/cron/reminders`, 08:00) emails the customer the invoice PDF and records each reminder so none is sent twice. Uses the same free email setup above.

### Activity log & trash (Phase 3)

The admin-only **Activity** page shows who did what and when across invoices, payments, customers, recurring plans, and team changes. Deleted invoices/customers/recurring plans move to **Trash** (a tab on the same page) where they can be restored; a daily cron (`/api/cron/purge-trash`, 03:00) hard-deletes anything older than 30 days. All three crons are protected by `CRON_SECRET`.

### Team invites (Phase 2)

An admin invites a teammate from **Team** → they get a link (`/invite/<token>`). Membership is granted only by presenting that **token** (never by email alone), so knowing an invited address is not enough to join. Email delivery of the link uses the same email setup below; until configured, the admin copies the link shown after creating the invite.

### Email (Phase 2, free by default)

No config needed in development — the app spins up a free **Ethereal** test inbox and the "Send" dialog shows a preview link to view the exact email. For real delivery set `SMTP_HOST/PORT/USER/PASS` + `EMAIL_FROM` (any free SMTP works: Gmail app password, Brevo, Mailtrap, Resend SMTP). Recurring plans with **auto-email** on will email each generated invoice.

## Deploy to Vercel

1. Push to a Git repo and import into Vercel.
2. Add all `.env.local` variables in the Vercel project (Environment Variables).
3. Vercel picks up `vercel.json` and schedules the cron automatically (it sends `CRON_SECRET` as a Bearer token).
4. Run `corepack pnpm db:migrate` against your production `DATABASE_URL` (or use a deploy hook).
