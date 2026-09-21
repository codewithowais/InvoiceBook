# Deploying InvoiceBook to Vercel

## 1. Import the repo
Vercel → Add New → Project → import `codewithowais/InvoiceBook`. Framework auto-detects as Next.js.

## 2. Environment variables (Project → Settings → Environment Variables)
Set these for **Production** (and Preview if you want preview builds to work):

| Key | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `BETTER_AUTH_SECRET` | long random string (`openssl rand -base64 32`) — **required at build time** |
| `BETTER_AUTH_URL` | your production URL, e.g. `https://<project>.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | same production URL |
| `CRON_SECRET` | long random string (protects the cron routes) |
| `BLOB_READ_WRITE_TOKEN` | auto-added when you connect a Blob store (see step 4) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | required for email in production |

> **`BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` must be the exact production domain** (https, no trailing slash). A mismatch is the #1 cause of "deploy works but I can't log in." Confirm the real domain in the **Domains** tab after the first deploy and update these if needed, then redeploy.

## 3. Deploy
Push to `main` (auto-deploys) or Deployments → Create Deployment. Env-var changes only apply to **new** deployments — redeploy after editing them. The database is already migrated (same Neon instance), so no migration step is needed at deploy.

## 4. Blob storage (for payment proof + logo upload)
Storage → create a **Blob** store → connect it to this project. Vercel injects `BLOB_READ_WRITE_TOKEN` automatically. Redeploy. Until this is done, recording a payment (proof upload) and logo upload will error; everything else works.

## 5. Email (for sending invoices + reminders)
Production has no dev test-inbox fallback, so set the `SMTP_*` vars with any free provider (Gmail app password, Brevo, Mailtrap, Resend SMTP). Without them, invoice email and reminder emails will error; nothing else is affected.

## 6. Cron jobs
`vercel.json` schedules three daily jobs (recurring invoices, reminders, trash purge). Vercel sends `CRON_SECRET` as a Bearer token automatically — no extra setup.

## 7. Health check
`GET /api/health` returns `{ status: "ok", db: "connected" }` (503 if the DB is unreachable). Point an uptime monitor at it.

## Production database note
For a clean launch, use a dedicated Neon database or branch for production rather than one that holds test data.
