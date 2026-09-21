"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { apiPost, ApiError } from "@/lib/fetcher";
import type { CreatedInvite, TeamRole } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";

export function InviteDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after a successful invite so the parent can refetch. */
  onInvited: () => void;
}) {
  const { toast } = useToast();
  // Local state starts fresh on every open because the parent remounts this
  // component with a changing `key` (React's recommended reset pattern), so no
  // reset-in-effect is needed.
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("staff");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  function validate() {
    if (!email.trim()) {
      setEmailError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address");
      return false;
    }
    setEmailError(undefined);
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const invite = await apiPost<CreatedInvite>("/api/team/invite", {
        email: email.trim(),
        role,
      });
      setCreated(invite);
      onInvited();
      toast({
        variant: "success",
        title: "Invite created — share this link",
        description: invite.email,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          const fe = err.fieldErrors();
          if (fe.email) setEmailError(fe.email);
        }
        toast({
          variant: "error",
          title: "Couldn't create invite",
          description: err.message,
        });
      } else {
        toast({ variant: "error", title: "Couldn't create invite" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.inviteUrl);
      setCopied(true);
      toast({ variant: "success", title: "Link copied to clipboard" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: "error",
        title: "Couldn't copy",
        description: "Select the link and copy it manually.",
      });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={created ? "Invite ready" : "Invite member"}
      description={
        created
          ? "Share this secure link so they can set a password and join your team."
          : "They'll set their own password from the invite link and join this business."
      }
      footer={
        created ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" form="invite-form" loading={saving}>
              Create invite
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <Field label="Invite link" htmlFor="invite-link">
            {(props) => (
              <div className="flex items-center gap-2">
                <Input
                  {...props}
                  id="invite-link"
                  readOnly
                  value={created.inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                  aria-label="Copy invite link"
                >
                  {copied ? (
                    <Check className="size-4 text-success" aria-hidden />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
            )}
          </Field>
          <p className="text-xs text-muted-2">
            Invited <span className="font-medium text-foreground">{created.email}</span>{" "}
            as {created.role}. The link expires in 7 days.
          </p>
        </div>
      ) : (
        <form id="invite-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Email" required error={emailError}>
            {(props) => (
              <Input
                {...props}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                invalid={Boolean(emailError)}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                disabled={saving}
              />
            )}
          </Field>
          <Field label="Role" hint="Admins can manage the team and settings.">
            {(props) => (
              <Select
                {...props}
                value={role}
                onChange={(e) => setRole(e.target.value as TeamRole)}
                disabled={saving}
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </Select>
            )}
          </Field>
        </form>
      )}
    </Dialog>
  );
}
