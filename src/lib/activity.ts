import "server-only";
import { db } from "@/db";
import { activityLog } from "@/db/schema";

export type ActivityAction =
  | "invoice.create"
  | "invoice.finalize"
  | "invoice.send"
  | "invoice.delete"
  | "invoice.restore"
  | "payment.record"
  | "payment.void"
  | "customer.create"
  | "customer.delete"
  | "customer.restore"
  | "recurring.create"
  | "recurring.pause"
  | "recurring.resume"
  | "recurring.generate"
  | "team.invite"
  | "team.update"
  | "settings.update";

export type LogInput = {
  businessId: string;
  actorId: string | null;
  action: ActivityAction;
  entityType: "invoice" | "payment" | "customer" | "recurring_plan" | "team" | "business";
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append an audit-log entry. Best-effort: logging must never break the action
 * it records, so failures are swallowed (with a console warning). Prefer
 * calling this AFTER the primary mutation has committed.
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await db.insert(activityLog).values({
      businessId: input.businessId,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    console.warn("[activity] failed to log", input.action, err);
  }
}
