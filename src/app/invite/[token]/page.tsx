import Link from "next/link";
import { XCircle } from "lucide-react";
import { env } from "@/env";
import type { InviteLookup } from "@/lib/types";
import { Logo } from "@/components/app-shell/logo";
import { buttonClasses } from "@/components/ui/button";
import { AcceptInviteForm } from "@/components/team/accept-invite-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

async function lookupInvite(token: string): Promise<InviteLookup> {
  try {
    const res = await fetch(
      `${env.APP_URL}/api/team/invite/${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    const body = (await res.json()) as { data?: InviteLookup };
    return body.data ?? { valid: false };
  } catch {
    return { valid: false };
  }
}

export default async function AcceptInvitePage({ params }: PageProps) {
  const { token } = await params;
  const invite = await lookupInvite(token);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-2 px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-7">
          {invite.valid ? (
            <>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                You&apos;ve been invited to join {invite.businessName}
              </h1>
              <p className="mt-1.5 text-sm text-muted">
                Set a password to finish creating your account and join the team
                as {invite.role}.
              </p>
              <AcceptInviteForm token={token} email={invite.email} />
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger ring-1 ring-inset ring-danger/20">
                <XCircle className="size-6" aria-hidden />
              </div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
                This invite is no longer valid
              </h1>
              <p className="mt-1.5 text-sm text-muted">
                The link may have expired, been revoked, or already been used.
                Ask an admin to send you a fresh invite.
              </p>
              <Link
                href="/login"
                className={buttonClasses("outline", "md", "mt-6 w-full")}
              >
                Go to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
