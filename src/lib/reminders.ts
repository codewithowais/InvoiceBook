import "server-only";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { businesses, invoiceReminders, invoices } from "@/db/schema";
import type { Business, Invoice } from "@/db/schema";
import { buildInvoicePdfForBusiness } from "@/lib/invoice-pdf";
import { sendMail } from "@/lib/email";
import { formatMoney } from "@/lib/money";
import { formatDate, toISODate } from "@/lib/format";

export type RunReminderResult = {
  before: number;
  overdue: number;
  errors: string[];
};

/** Parse a `yyyy-mm-dd` day string into a UTC-midnight Date for day math. */
function parseDay(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
}

/** Whole-day difference `a - b` (calendar days, both at UTC midnight). */
function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build + send a single reminder email (with the invoice PDF attached) and
 * record an `invoiceReminders` row. Returns true when a mail was actually sent,
 * false when the invoice has no customer email (skipped, nothing recorded).
 * Throws on a genuine send/build failure so the caller can collect the error
 * without aborting the whole run.
 */
async function sendReminder(
  inv: Invoice,
  biz: Business,
  kind: "before_due" | "overdue",
): Promise<boolean> {
  const built = await buildInvoicePdfForBusiness(inv.id, biz.id);
  if (!built) throw new Error("could not build invoice PDF");

  const to = built.customer.email;
  // Never send to a missing email; record nothing.
  if (!to) return false;

  const number = inv.number ?? "Invoice";
  const outstanding = inv.total - inv.amountPaid;
  const amountLabel = formatMoney(outstanding, inv.currency);
  const dueDateLabel = formatDate(inv.dueDate);
  const businessName = built.business.name;

  const subject =
    kind === "before_due"
      ? `Reminder: Invoice ${number} from ${businessName} is due ${dueDateLabel}`
      : `Overdue: Invoice ${number} from ${businessName}`;

  const intro =
    kind === "before_due"
      ? `This is a friendly reminder that invoice ${number} for ${amountLabel} is due on ${dueDateLabel}.`
      : `Our records show that invoice ${number} for ${amountLabel} was due on ${dueDateLabel} and is now overdue. Please arrange payment at your earliest convenience.`;

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <h2 style="margin:0 0 4px">${escapeHtml(businessName)}</h2>
    <p style="color:#666;margin:0 0 20px">Invoice ${escapeHtml(number)}</p>
    <p style="line-height:1.6">${escapeHtml(intro)}</p>
    <table style="margin:20px 0;border-collapse:collapse">
      <tr><td style="padding:4px 16px 4px 0;color:#666">Amount outstanding</td><td style="font-weight:600">${escapeHtml(amountLabel)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#666">Due date</td><td style="font-weight:600">${escapeHtml(dueDateLabel)}</td></tr>
    </table>
    <p style="color:#666;font-size:13px;line-height:1.6">The invoice is attached as a PDF for your reference. If you have already paid, please disregard this message.</p>
  </div>`;

  const text = `${businessName}\nInvoice ${number}\n\n${intro}\n\nAmount outstanding: ${amountLabel}\nDue date: ${dueDateLabel}\n\nThe invoice is attached as a PDF. If you have already paid, please disregard this message.`;

  await sendMail({
    to,
    subject,
    html,
    text,
    attachments: [
      {
        filename: built.fileName,
        content: built.pdf,
        contentType: "application/pdf",
      },
    ],
  });

  await db.insert(invoiceReminders).values({
    invoiceId: inv.id,
    businessId: biz.id,
    kind,
  });

  return true;
}

/**
 * Scan every business that has any reminder type enabled and send due
 * payment reminders for its open (unpaid / partially paid) invoices.
 *
 * Cadence per invoice:
 *  - before_due: sent once, on the day `today === dueDate − reminderDaysBefore`,
 *    when the business has `reminderEnabled` and no prior before_due row exists.
 *  - overdue: sent when `today > dueDate` and the business has
 *    `overdueReminderEnabled` — either the first overdue reminder, or once at
 *    least `overdueReminderEveryDays` have passed since the last one — capped at
 *    `maxReminders` overdue reminders per invoice.
 *
 * `invoiceReminders` rows are the idempotency guard: the same reminder is never
 * sent twice. A single send/build failure is collected in `errors` and never
 * aborts the run.
 */
export async function runDueReminders(asOf: Date): Promise<RunReminderResult> {
  const todayStr = toISODate(asOf);
  const todayDay = parseDay(todayStr);

  let before = 0;
  let overdue = 0;
  const errors: string[] = [];

  const bizList = await db
    .select()
    .from(businesses)
    .where(
      or(
        eq(businesses.reminderEnabled, true),
        eq(businesses.overdueReminderEnabled, true),
      ),
    );

  for (const biz of bizList) {
    const openInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.businessId, biz.id),
          inArray(invoices.status, ["unpaid", "partially_paid"]),
          isNull(invoices.deletedAt),
        ),
      );

    if (openInvoices.length === 0) continue;

    // Load this business's reminder history once and index it per invoice.
    const history = await db
      .select()
      .from(invoiceReminders)
      .where(eq(invoiceReminders.businessId, biz.id));

    const byInvoice = new Map<
      string,
      { hasBefore: boolean; overdueSentAt: Date[] }
    >();
    for (const row of history) {
      const entry =
        byInvoice.get(row.invoiceId) ?? { hasBefore: false, overdueSentAt: [] };
      if (row.kind === "before_due") entry.hasBefore = true;
      else entry.overdueSentAt.push(row.sentAt);
      byInvoice.set(row.invoiceId, entry);
    }

    for (const inv of openInvoices) {
      const existing =
        byInvoice.get(inv.id) ?? { hasBefore: false, overdueSentAt: [] };
      const dueDay = parseDay(inv.dueDate);
      const daysUntilDue = diffDays(dueDay, todayDay); // due − today
      const daysOverdue = -daysUntilDue; // today − due

      // --- before_due: exactly N days before the due date, once. ---
      if (
        biz.reminderEnabled &&
        !existing.hasBefore &&
        daysUntilDue === biz.reminderDaysBefore
      ) {
        try {
          if (await sendReminder(inv, biz, "before_due")) before++;
        } catch (err) {
          errors.push(
            `${inv.number ?? inv.id} (before_due): ${
              err instanceof Error ? err.message : "send failed"
            }`,
          );
        }
        continue; // not overdue on this day; skip overdue check
      }

      // --- overdue: past due, capped and rate-limited. ---
      if (biz.overdueReminderEnabled && daysOverdue >= 1) {
        const sentCount = existing.overdueSentAt.length;
        if (sentCount >= biz.maxReminders) continue;

        let shouldSend = sentCount === 0;
        if (!shouldSend) {
          const lastSent = existing.overdueSentAt.reduce((a, b) =>
            a > b ? a : b,
          );
          const lastSentDay = parseDay(toISODate(lastSent));
          if (diffDays(todayDay, lastSentDay) >= biz.overdueReminderEveryDays) {
            shouldSend = true;
          }
        }

        if (shouldSend) {
          try {
            if (await sendReminder(inv, biz, "overdue")) overdue++;
          } catch (err) {
            errors.push(
              `${inv.number ?? inv.id} (overdue): ${
                err instanceof Error ? err.message : "send failed"
              }`,
            );
          }
        }
      }
    }
  }

  return { before, overdue, errors };
}
