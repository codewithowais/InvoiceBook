import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { handler, ok, fail } from "@/lib/api";
import { reminderSettingsSchema } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

/** The five reminder fields, always scoped to the caller's business. */
const reminderColumns = {
  reminderEnabled: businesses.reminderEnabled,
  reminderDaysBefore: businesses.reminderDaysBefore,
  overdueReminderEnabled: businesses.overdueReminderEnabled,
  overdueReminderEveryDays: businesses.overdueReminderEveryDays,
  maxReminders: businesses.maxReminders,
};

export const GET = handler(async () => {
  const user = await requireAdmin();
  const [row] = await db
    .select(reminderColumns)
    .from(businesses)
    .where(eq(businesses.id, user.businessId))
    .limit(1);
  if (!row) return fail("Business not found", 404);
  return ok(row);
});

export const PATCH = handler(async (req: Request) => {
  const user = await requireAdmin();
  const body = reminderSettingsSchema.parse(await req.json());

  const [updated] = await db
    .update(businesses)
    .set({
      reminderEnabled: body.reminderEnabled,
      reminderDaysBefore: body.reminderDaysBefore,
      overdueReminderEnabled: body.overdueReminderEnabled,
      overdueReminderEveryDays: body.overdueReminderEveryDays,
      maxReminders: body.maxReminders,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, user.businessId))
    .returning(reminderColumns);

  if (!updated) return fail("Business not found", 404);

  await logActivity({
    businessId: user.businessId,
    actorId: user.id,
    action: "settings.update",
    entityType: "business",
    entityId: user.businessId,
    metadata: { section: "reminders", ...body },
  });

  return ok(updated);
});
