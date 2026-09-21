# Phase 2 — User Story 1: Admin Team Flow (build notes)

Team management (invite members, manage roles/activation, accept-invite, invoice
audit surfacing). Built to match existing InvoiceBook conventions
(`handler`/`ok`/`fail`, `requireUser`/`requireAdmin`, `businessId` scoping,
`fetcher` + UI primitives). No frozen file was modified.

## API endpoints (all under `src/app/api/team`)

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/team` | admin | Lists members (active + inactive) `{id,name,email,role,isActive,createdAt}` and pending, non-expired invites `{id,email,role,expiresAt}`. Scoped to caller's `businessId`. |
| `POST /api/team/invite` | admin | Validates with `inviteCreateSchema`; rejects (409) if the email is already a member OR has a pending non-expired invite in this business; creates an `invitations` row with a random `crypto.randomUUID()` token, `status:'pending'`, `expiresAt = now + 7 days`, `createdBy = caller`. Returns the invite plus `inviteUrl = ${APP_URL}/invite/${token}`. Rate-limited per user (`team-invite:<userId>`, 10/min → 429). |
| `POST /api/team/invite/[id]/revoke` | admin | Sets a still-pending invite to `revoked` (409 otherwise). Scoped to caller's `businessId` (IDOR). |
| `GET /api/team/invite/[token]` | **public** | Accept-page lookup. Returns only `{email, role, businessName, valid}`. Any invalid/revoked/accepted/expired token → `{valid:false}` with nothing else leaked. |
| `PATCH /api/team/[id]` | admin | `teamMemberUpdateSchema`; change `role` and/or `isActive` for a member in the caller's business (IDOR-scoped). Guardrails below. |

### Next.js routing note (slug naming)
Next.js allows only one dynamic slug name per segment. `GET .../invite/[token]`
and `POST .../invite/[id]/revoke` therefore share one `[token]` folder:
`invite/[token]/route.ts` (public GET) and `invite/[token]/revoke/route.ts`
(admin POST). In the revoke handler the segment carries the invitation **id**
(the URL is `/api/team/invite/:id/revoke`); it's read as `const { token: id }`.
The public URL and the revoke URL are exactly as specified in the brief.

## Guardrails (PATCH /api/team/[id])
- **Self role change** → 409 "You cannot change your own role."
- **Self deactivate** (`isActive:false` on own row) → 409 "You cannot deactivate yourself."
- **Last active admin** — if the change would remove the target from the set of
  active admins (`role==='admin' && isActive`), a count of *other* active admins
  in the business must be > 0, else 409 "At least one admin is required."
- Empty patch (no `role`/`isActive`) → 400.
- Every read/write is `AND businessId = caller.businessId` so one business can
  never see or mutate another's users or invites.

Note: deactivation is enforced at the session layer — `getCurrentUser()` already
returns `null` when `isActive` is false, so a deactivated member cannot sign in.
Accepting an invite is handled by the existing Better Auth `user.create.after`
hook (frozen `src/lib/auth.ts`), which matches a pending, non-expired invite by
email and joins the new user to that business with the invited role.

## Pages
- `src/app/(app)/team/page.tsx` — admin-only server component gate
  (`getCurrentUser()`; non-admins redirected to `/dashboard`). Renders
  `TeamClient` with the current user's id.
- `src/components/team/team-client.tsx` — members table (name, email, role
  badge, status), inline role `<select>` (staff↔admin) and activate/deactivate
  via `ConfirmDialog`; own row shows "This is you" with actions disabled.
  Pending-invites table with role, expiry and Revoke (ConfirmDialog). Loading
  skeletons, empty and error states; buttons disable while pending; toasts on
  every mutation; 409 guardrail messages surfaced from the server.
- `src/components/team/invite-dialog.tsx` — email + role dialog; on success
  shows the invite link in a read-only field with a Copy button + success toast.
  Reset-on-open uses a changing `key` from the parent (no reset-in-effect).
- `src/app/invite/[token]/page.tsx` — **public** accept page (outside `(app)`),
  server-fetches `GET /api/team/invite/[token]`. Invalid/expired → friendly
  "This invite is no longer valid" card linking to `/login`. Valid → "You've
  been invited to join {businessName}" + signup form (name + password; email
  read-only, fixed to the invited address). Submits via
  `authClient.signUp.email({ email, name, password })`; success → `/dashboard`.
  Client-side password length ≥ 8. Mirrors `(auth)/signup` styling.
- `src/components/team/accept-invite-form.tsx` — the client signup form above.

## Invoice audit surfacing (PRD: "admin sees who created and last changed each invoice")
- `src/app/api/invoices/[id]/route.ts` (GET) now resolves the names behind
  `createdBy`/`updatedBy` (single `inArray` lookup on `user`) and returns
  `createdByName` / `updatedByName`. Minimal, additive; no behavior change.
- `src/lib/types.ts` — `InvoiceDetail` gains optional `createdByName` /
  `updatedByName`, plus team DTOs (`TeamMember`, `PendingInvite`,
  `TeamOverview`, `CreatedInvite`, `InviteLookup`).
- `src/app/(app)/invoices/[id]/page.tsx` — shows a subtle
  "Created by X · Last updated by Y" line under the invoice body.

## Verification
- `corepack pnpm exec tsc --noEmit`: clean for all files in this vertical.
- `corepack pnpm exec eslint` on all created/edited files: clean.
- Pre-existing unrelated tsc error `src/app/(app)/reports/page.tsx` (missing
  `@/components/reports/reports-client`) belongs to the parallel Reports
  vertical (DO NOT TOUCH) and is not part of this work.

## Assumptions
- Invite emails are normalized to lowercase/trimmed on create for consistent
  duplicate + acceptance matching against the Better Auth hook.
- Membership duplicate check is scoped to the caller's business per the brief
  (email is globally unique on `user`, so an existing account elsewhere would
  fail signup anyway and can't accept the invite).
- The accept page reads `APP_URL` (from `env`) to reach the public lookup route
  during SSR; falls back to `{valid:false}` if the fetch fails.
- Invite rate limit set to 10/min per admin (in-memory limiter, single instance).
