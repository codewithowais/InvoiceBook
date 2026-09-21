"use client";

import { useEffect, useState } from "react";
import { apiPatch, apiPost, ApiError } from "@/lib/fetcher";
import type { Customer } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

type FormState = {
  name: string;
  email: string;
  phone: string;
  billingAddress: string;
  notes: string;
};

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  billingAddress: "",
  notes: "",
};

export function CustomerFormDialog({
  open,
  onClose,
  customer,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** When provided, the dialog edits this customer; otherwise it creates one. */
  customer?: Customer | null;
  onSaved: (customer: Customer) => void;
}) {
  const { toast } = useToast();
  const isEdit = Boolean(customer);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        customer
          ? {
              name: customer.name ?? "",
              email: customer.email ?? "",
              phone: customer.phone ?? "",
              billingAddress: customer.billingAddress ?? "",
              notes: customer.notes ?? "",
            }
          : EMPTY,
      );
      setErrors({});
    }
  }, [open, customer]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Enter a valid email address";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      billingAddress: form.billingAddress.trim() || null,
      notes: form.notes.trim() || null,
    };

    try {
      const saved = isEdit
        ? await apiPatch<Customer>(`/api/customers/${customer!.id}`, payload)
        : await apiPost<Customer>("/api/customers", payload);
      toast({
        variant: "success",
        title: isEdit ? "Customer updated" : "Customer added",
        description: saved.name,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setErrors((prev) => ({ ...prev, ...err.fieldErrors() }));
        }
        toast({
          variant: "error",
          title: "Couldn't save customer",
          description: err.message,
        });
      } else {
        toast({ variant: "error", title: "Couldn't save customer" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title={isEdit ? "Edit customer" : "New customer"}
      description={
        isEdit
          ? "Changes won't alter details already saved on finalized invoices."
          : "Add someone you'll bill invoices to."
      }
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" loading={saving}>
            {isEdit ? "Save changes" : "Add customer"}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Name" required error={errors.name}>
          {(props) => (
            <Input
              {...props}
              value={form.name}
              autoComplete="name"
              invalid={Boolean(errors.name)}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Acme Studios"
            />
          )}
        </Field>
        <Field label="Email" required error={errors.email}>
          {(props) => (
            <Input
              {...props}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              invalid={Boolean(errors.email)}
              onChange={(e) => set("email", e.target.value)}
              placeholder="billing@acme.com"
            />
          )}
        </Field>
        <Field label="Phone" error={errors.phone} hint="Optional">
          {(props) => (
            <Input
              {...props}
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+1 555 000 1234"
            />
          )}
        </Field>
        <Field label="Billing address" error={errors.billingAddress} hint="Optional">
          {(props) => (
            <Textarea
              {...props}
              value={form.billingAddress}
              onChange={(e) => set("billingAddress", e.target.value)}
              placeholder="123 Market St, Suite 400&#10;San Francisco, CA 94103"
              rows={2}
            />
          )}
        </Field>
        <Field label="Notes" error={errors.notes} hint="Only visible to your team">
          {(props) => (
            <Textarea
              {...props}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Prefers bank transfer, net-30 terms…"
              rows={2}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
