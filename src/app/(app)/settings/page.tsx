"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, ImageUp, Info, Loader2, Users } from "lucide-react";
import { apiGet, apiPatch, uploadFile, ApiError } from "@/lib/fetcher";
import { useAsync } from "@/lib/use-async";
import { useBusiness } from "@/components/app-shell/business-context";
import type { Business } from "@/lib/types";
import { CURRENCIES, currencyLabel } from "@/lib/currency";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { LoadingBlock } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/empty-state";
import { ReminderSettings } from "@/components/settings/reminder-settings";

type Form = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  logoUrl: string;
  bankDetails: string;
  defaultCurrency: string;
  invoicePrefix: string;
};

function toForm(b: Business): Form {
  return {
    name: b.name ?? "",
    addressLine1: b.addressLine1 ?? "",
    addressLine2: b.addressLine2 ?? "",
    city: b.city ?? "",
    state: b.state ?? "",
    postalCode: b.postalCode ?? "",
    country: b.country ?? "",
    logoUrl: b.logoUrl ?? "",
    bankDetails: b.bankDetails ?? "",
    defaultCurrency: b.defaultCurrency ?? "USD",
    invoicePrefix: b.invoicePrefix ?? "INV",
  };
}

const ACCEPTED_IMG = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export default function SettingsPage() {
  const { toast } = useToast();
  const { role } = useBusiness();
  const canEdit = role === "admin";
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, loading, error, refetch } = useAsync<Business>(
    () => apiGet<Business>("/api/business"),
    [],
    "/api/business",
  );

  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function onLogoPick(file: File | null) {
    if (!file || !form) return;
    if (!ACCEPTED_IMG.includes(file.type)) {
      toast({
        variant: "error",
        title: "Unsupported image",
        description: "Use a PNG, JPG, SVG or WebP file.",
      });
      return;
    }
    setUploading(true);
    try {
      const res = await uploadFile("/api/uploads/logo", file);
      set("logoUrl", res.url);
      toast({ variant: "success", title: "Logo uploaded", description: "Save to apply." });
    } catch (err) {
      toast({
        variant: "error",
        title: "Upload failed",
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function validate(f: Form) {
    const next: typeof errors = {};
    if (!f.name.trim()) next.name = "Business name is required";
    if (!f.invoicePrefix.trim()) next.invoicePrefix = "A prefix is required";
    else if (f.invoicePrefix.length > 10) next.invoicePrefix = "Keep it under 10 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !validate(form)) return;
    setSaving(true);
    try {
      await apiPatch<Business>("/api/business", {
        name: form.name.trim(),
        addressLine1: form.addressLine1.trim() || null,
        addressLine2: form.addressLine2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postalCode: form.postalCode.trim() || null,
        country: form.country.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
        bankDetails: form.bankDetails.trim() || null,
        defaultCurrency: form.defaultCurrency,
        invoicePrefix: form.invoicePrefix.trim(),
      });
      toast({ variant: "success", title: "Settings saved" });
      refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) setErrors((p) => ({ ...p, ...err.fieldErrors() }));
        toast({
          variant: "error",
          title: "Couldn't save settings",
          description: err.message,
        });
      } else {
        toast({ variant: "error", title: "Couldn't save settings" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Business settings"
        description="These details appear on every invoice and PDF you generate."
      />

      {loading ? (
        <Card>
          <LoadingBlock label="Loading settings…" />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState description={error} onRetry={refetch} />
        </Card>
      ) : form ? (
        <div className="space-y-6">
        <form onSubmit={onSubmit} className="space-y-6">
          {!canEdit ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm text-muted">
              <Info className="size-4" aria-hidden />
              Only admins can change business settings. You have read-only access.
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Logo + identity */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Brand</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-surface-2">
                    {form.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.logoUrl}
                        alt="Business logo"
                        className="size-full object-contain"
                      />
                    ) : (
                      <Building2 className="size-6 text-muted-2" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0">
                    <input
                      ref={fileRef}
                      id="logo-file"
                      type="file"
                      accept={ACCEPTED_IMG.join(",")}
                      className="sr-only"
                      disabled={!canEdit || uploading}
                      onChange={(e) => onLogoPick(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canEdit || uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <ImageUp className="size-4" aria-hidden />
                      )}
                      {uploading ? "Uploading…" : "Upload logo"}
                    </Button>
                    <p className="mt-1.5 text-xs text-muted-2">PNG, JPG, SVG or WebP</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Details */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Business details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Business name" required error={errors.name}>
                  {(props) => (
                    <Input
                      {...props}
                      value={form.name}
                      disabled={!canEdit}
                      invalid={Boolean(errors.name)}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Acme Studios LLC"
                    />
                  )}
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Default currency">
                    {(props) => (
                      <Select
                        {...props}
                        value={form.defaultCurrency}
                        disabled={!canEdit}
                        onChange={(e) => set("defaultCurrency", e.target.value)}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {currencyLabel(c)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field
                    label="Invoice prefix"
                    error={errors.invoicePrefix}
                    hint="e.g. INV → INV-0001"
                  >
                    {(props) => (
                      <Input
                        {...props}
                        value={form.invoicePrefix}
                        disabled={!canEdit}
                        maxLength={10}
                        invalid={Boolean(errors.invoicePrefix)}
                        onChange={(e) =>
                          set("invoicePrefix", e.target.value.toUpperCase())
                        }
                        className="font-mono uppercase"
                      />
                    )}
                  </Field>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Billing address</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Address line 1" className="sm:col-span-2">
                {(props) => (
                  <Input
                    {...props}
                    value={form.addressLine1}
                    autoComplete="address-line1"
                    disabled={!canEdit}
                    onChange={(e) => set("addressLine1", e.target.value)}
                    placeholder="123 Market Street"
                  />
                )}
              </Field>
              <Field label="Address line 2" className="sm:col-span-2">
                {(props) => (
                  <Input
                    {...props}
                    value={form.addressLine2}
                    autoComplete="address-line2"
                    disabled={!canEdit}
                    onChange={(e) => set("addressLine2", e.target.value)}
                    placeholder="Suite 400"
                  />
                )}
              </Field>
              <Field label="City">
                {(props) => (
                  <Input
                    {...props}
                    value={form.city}
                    autoComplete="address-level2"
                    disabled={!canEdit}
                    onChange={(e) => set("city", e.target.value)}
                  />
                )}
              </Field>
              <Field label="State / Province">
                {(props) => (
                  <Input
                    {...props}
                    value={form.state}
                    autoComplete="address-level1"
                    disabled={!canEdit}
                    onChange={(e) => set("state", e.target.value)}
                  />
                )}
              </Field>
              <Field label="Postal code">
                {(props) => (
                  <Input
                    {...props}
                    value={form.postalCode}
                    autoComplete="postal-code"
                    disabled={!canEdit}
                    onChange={(e) => set("postalCode", e.target.value)}
                  />
                )}
              </Field>
              <Field label="Country">
                {(props) => (
                  <Input
                    {...props}
                    value={form.country}
                    autoComplete="country-name"
                    disabled={!canEdit}
                    onChange={(e) => set("country", e.target.value)}
                  />
                )}
              </Field>
            </CardContent>
          </Card>

          {/* Payment details — shown on invoice PDFs */}
          <Card>
            <CardHeader>
              <CardTitle>Payment details</CardTitle>
            </CardHeader>
            <CardContent>
              <Field
                label="Bank / payment instructions"
                hint="Shown in a 'Payment Details' block on every invoice PDF. Include bank name, account title, account number, IBAN, etc."
              >
                {(props) => (
                  <Textarea
                    {...props}
                    rows={4}
                    value={form.bankDetails}
                    disabled={!canEdit}
                    onChange={(e) => set("bankDetails", e.target.value)}
                    placeholder={"Bank: HBL\nAccount title: Muhammad Owais Ahmed\nAccount #: 1234-5678901234\nIBAN: PK00HABB0000123456789012"}
                  />
                )}
              </Field>
            </CardContent>
          </Card>

          {/* Team management */}
          <Card>
            <CardContent className="flex items-center gap-3 py-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-muted-2">
                <Users className="size-5" aria-hidden />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Team management
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  Invite teammates and assign roles.
                </p>
              </div>
              <ButtonLink href="/team" variant="outline" size="sm">
                Manage team
              </ButtonLink>
            </CardContent>
          </Card>

          {canEdit ? (
            <div className="sticky bottom-4 flex justify-end">
              <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-border bg-surface/90 px-4 py-3 shadow-md backdrop-blur">
                <span className="text-sm text-muted">Ready to apply changes?</span>
                <Button type="submit" loading={saving}>
                  Save settings
                </Button>
              </div>
            </div>
          ) : null}
        </form>

        {/* Payment reminders — Phase 3 (admin only) */}
        {canEdit ? <ReminderSettings /> : null}
        </div>
      ) : null}
    </div>
  );
}
