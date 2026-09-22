"use client";

import { useState } from "react";
import { Mail, UserPlus, Users, X } from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import type {
  PendingInvite,
  TeamMember,
  TeamOverview,
  TeamRole,
} from "@/lib/types";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { InviteDialog } from "@/components/team/invite-dialog";

export function TeamClient({ currentUserId }: { currentUserId: string }) {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useAsync<TeamOverview>(
    () => apiGet<TeamOverview>("/api/team"),
    [],
    "/api/team",
  );

  const [inviteOpen, setInviteOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<TeamMember | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PendingInvite | null>(null);

  const members = data?.members ?? [];
  const invites = data?.invites ?? [];

  async function changeRole(member: TeamMember, role: TeamRole) {
    if (role === member.role) return;
    setBusyId(member.id);
    try {
      await apiPatch(`/api/team/${member.id}`, { role });
      toast({
        variant: "success",
        title: "Role updated",
        description: `${member.name} is now ${role}.`,
      });
      refetch();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't update role",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive() {
    if (!statusTarget) return;
    const member = statusTarget;
    const next = !member.isActive;
    setBusyId(member.id);
    try {
      await apiPatch(`/api/team/${member.id}`, { isActive: next });
      toast({
        variant: "success",
        title: next ? "Member reactivated" : "Member deactivated",
        description: member.name,
      });
      setStatusTarget(null);
      refetch();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't update member",
        description: err instanceof ApiError ? err.message : undefined,
      });
      setStatusTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  async function revokeInvite() {
    if (!revokeTarget) return;
    const invite = revokeTarget;
    setBusyId(invite.id);
    try {
      await apiPost(`/api/team/invite/${invite.id}/revoke`);
      toast({ variant: "success", title: "Invite revoked", description: invite.email });
      setRevokeTarget(null);
      refetch();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't revoke invite",
        description: err instanceof ApiError ? err.message : undefined,
      });
      setRevokeTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Team"
        description="Invite people to your business and manage their access."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            Invite member
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[0.9375rem] font-semibold text-foreground">
            Members
          </h2>
        </div>

        {loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : error ? (
          <ErrorState description={error} onRetry={refetch} />
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members yet"
            description="Invite your first teammate to collaborate on invoicing."
            action={
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-4" aria-hidden />
                Invite member
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Member</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {members.map((m) => {
                const isSelf = m.id === currentUserId;
                const busy = busyId === m.id;
                return (
                  <TR key={m.id}>
                    <TD>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {m.name}
                          {isSelf ? (
                            <span className="ml-2 text-xs font-normal text-muted-2">
                              This is you
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-2">{m.email}</p>
                      </div>
                    </TD>
                    <TD>
                      {isSelf ? (
                        <Badge variant={m.role === "admin" ? "primary" : "neutral"}>
                          {m.role === "admin" ? "Admin" : "Staff"}
                        </Badge>
                      ) : (
                        <Select
                          aria-label={`Role for ${m.name}`}
                          value={m.role}
                          disabled={busy}
                          onChange={(e) =>
                            changeRole(m, e.target.value as TeamRole)
                          }
                          className="h-9 w-28"
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </Select>
                      )}
                    </TD>
                    <TD>
                      {m.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      {isSelf ? (
                        <span className="text-xs text-muted-2">—</span>
                      ) : (
                        <Button
                          variant={m.isActive ? "ghost" : "outline"}
                          size="sm"
                          disabled={busy}
                          onClick={() => setStatusTarget(m)}
                          className={
                            m.isActive ? "text-muted-2 hover:text-danger" : ""
                          }
                        >
                          {m.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Pending invitations */}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[0.9375rem] font-semibold text-foreground">
            Pending invitations
          </h2>
        </div>
        {loading ? (
          <TableSkeleton rows={2} cols={3} />
        ) : error ? null : invites.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No pending invites"
            description="Invites you send will appear here until they're accepted."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Expires</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {invites.map((inv) => (
                <TR key={inv.id}>
                  <TD className="font-medium text-foreground">{inv.email}</TD>
                  <TD>
                    <Badge variant={inv.role === "admin" ? "primary" : "neutral"}>
                      {inv.role === "admin" ? "Admin" : "Staff"}
                    </Badge>
                  </TD>
                  <TD className="text-muted">{formatDate(inv.expiresAt)}</TD>
                  <TD className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === inv.id}
                      onClick={() => setRevokeTarget(inv)}
                      className="text-muted-2 hover:text-danger"
                    >
                      <X className="size-4" aria-hidden />
                      Revoke
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <InviteDialog
        key={inviteOpen ? "invite-open" : "invite-closed"}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={refetch}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={toggleActive}
        title={
          statusTarget?.isActive
            ? "Deactivate this member?"
            : "Reactivate this member?"
        }
        description={
          statusTarget?.isActive
            ? `${statusTarget?.name} will no longer be able to sign in. You can reactivate them anytime.`
            : `${statusTarget?.name} will be able to sign in again.`
        }
        confirmLabel={statusTarget?.isActive ? "Deactivate" : "Reactivate"}
        variant={statusTarget?.isActive ? "danger" : "primary"}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={revokeInvite}
        title="Revoke this invite?"
        description={`The link sent to ${revokeTarget?.email} will stop working immediately.`}
        confirmLabel="Revoke invite"
        variant="danger"
      />
    </div>
  );
}
