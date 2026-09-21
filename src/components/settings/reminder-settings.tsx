"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { apiGet, apiPatch, ApiError } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { LoadingBlock } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";

/** Mirrors the 5 reminder fields returned by GET /api/reminders/settings. */
type ReminderSettings = {
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  overdueReminderEnabled: boolean;
  overdueReminderEveryDays: number;
  maxReminders: number;
};

type Form = {
  reminderEnabled: boolean;
  reminderDaysBefore: string;
  overdueReminderEnabled: boolean;
  overdueReminderEveryDays: string;
  maxReminders: string;
};

type Errors = Partial<Record<keyof Form, string>>;

function toForm(s: ReminderSettings): Form {
  return {
    reminderEnabled: s.reminderEnabled,
    reminderDaysBefore: String(s.reminderDaysBefore),
    overdueReminderEnabled: s.overdueReminderEnabled,
    overdueReminderEveryDays: String(s.overdueReminderEveryDays),
    maxReminders: String(s.maxReminders),
  };
}

/**
 * Admin-only Payment reminders section. Mounted only when the caller is an
 * admin (GET/PATCH are admin-scoped), so this component's fetch never 403s.
 */
export function ReminderSettings() {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useAsync<ReminderSettings>(
    () => apiGet<ReminderSettings>("/api/reminders/settings"),
    [],
  );

  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  // Validation mirrors reminderSettingsSchema:
  //   reminderDaysBefore 0-60, overdueReminderEveryDays 1-90, maxReminders 1-20.
  function validate(f: Form): boolean {
    const next: Errors = {};
    if (f.reminderEnabled) {
      const n = Number(f.reminderDaysBefore);
      if (!Number.isInteger(n) || n < 0 || n > 60) {
        next.reminderDaysBefore = "Enter a whole number between 0 and 60";
      }
    }
    if (f.overdueReminderEnabled) {
      const every = Number(f.overdueReminderEveryDays);
      if (!Number.isInteger(every) || every < 1 || every > 90) {
        next.overdueReminderEveryDays = "Enter a whole number between 1 and 90";
      }
      const max = Number(f.maxReminders);
      if (!Number.isInteger(max) || max < 1 || max > 20) {
        next.maxReminders = "Enter a whole number between 1 and 20";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !validate(form)) return;
    setSaving(true);
    try {
      const saved = await apiPatch<ReminderSettings>("/api/reminders/settings", {
        reminderEnabled: form.reminderEnabled,
        reminderDaysBefore: Number(form.reminderDaysBefore),
        overdueReminderEnabled: form.overdueReminderEnabled,
        overdueReminderEveryDays: Number(form.overdueReminderEveryDays),
        maxReminders: Number(form.maxReminders),
      });
      setForm(toForm(saved));
      toast({ variant: "success", title: "Reminder settings saved" });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) setErrors((p) => ({ ...p, ...err.fieldErrors() }));
        toast({
          variant: "error",
          title: "Couldn't save reminders",
          description: err.message,
        });
      } else {
        toast({ variant: "error", title: "Couldn't save reminders" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-4 text-muted-2" aria-hidden />
          Payment reminders
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingBlock label="Loading reminder settings…" />
        ) : error ? (
          <ErrorState description={error} onRetry={refetch} />
        ) : form ? (
          <form onSubmit={onSubmit} className="space-y-6">
            <p className="text-sm text-muted">
              Automatically email customers about invoices that are unpaid or
              partially paid. Each reminder is recorded on the invoice.
            </p>

            {/* Before due */}
            <div className="space-y-4 rounded-lg border border-border bg-surface-2 p-4">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={form.reminderEnabled}
                  disabled={saving}
                  onChange={(e) => set("reminderEnabled", e.target.checked)}
                  className="mt-0.5 size-4 rounded border-border-strong"
                />
                <span className="text-sm">
                  <span className="block font-medium text-foreground">
                    Send reminders before the due date
                  </span>
                  <span className="text-xs text-muted-2">
                    A single heads-up email a set number of days before an
                    invoice is due.
                  </span>
                </span>
              </label>

              {form.reminderEnabled ? (
                <div className="pl-6 sm:max-w-xs">
                  <Field
                    label="Days before due date"
                    error={errors.reminderDaysBefore}
                    hint="0–60 days"
                  >
                    {(props) => (
                      <Input
                        {...props}
                        type="number"
                        min={0}
                        max={60}
                        value={form.reminderDaysBefore}
                        disabled={saving}
                        invalid={Boolean(errors.reminderDaysBefore)}
                        onChange={(e) =>
                          set("reminderDaysBefore", e.target.value)
                        }
                      />
                    )}
                  </Field>
                </div>
              ) : null}
            </div>

            {/* Overdue */}
            <div className="space-y-4 rounded-lg border border-border bg-surface-2 p-4">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={form.overdueReminderEnabled}
                  disabled={saving}
                  onChange={(e) =>
                    set("overdueReminderEnabled", e.target.checked)
                  }
                  className="mt-0.5 size-4 rounded border-border-strong"
                />
                <span className="text-sm">
                  <span className="block font-medium text-foreground">
                    Send overdue reminders
                  </span>
                  <span className="text-xs text-muted-2">
                    Follow up on a repeating schedule once an invoice passes its
                    due date.
                  </span>
                </span>
              </label>

              {form.overdueReminderEnabled ? (
                <div className="grid gap-4 pl-6 sm:grid-cols-2">
                  <Field
                    label="Repeat every (days)"
                    error={errors.overdueReminderEveryDays}
                    hint="1–90 days"
                  >
                    {(props) => (
                      <Input
                        {...props}
                        type="number"
                        min={1}
                        max={90}
                        value={form.overdueReminderEveryDays}
                        disabled={saving}
                        invalid={Boolean(errors.overdueReminderEveryDays)}
                        onChange={(e) =>
                          set("overdueReminderEveryDays", e.target.value)
                        }
                      />
                    )}
                  </Field>
                  <Field
                    label="Maximum reminders"
                    error={errors.maxReminders}
                    hint="1–20 total per invoice"
                  >
                    {(props) => (
                      <Input
                        {...props}
                        type="number"
                        min={1}
                        max={20}
                        value={form.maxReminders}
                        disabled={saving}
                        invalid={Boolean(errors.maxReminders)}
                        onChange={(e) => set("maxReminders", e.target.value)}
                      />
                    )}
                  </Field>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={saving}>
                Save reminders
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
