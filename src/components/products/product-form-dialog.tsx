"use client";

import { useEffect, useState } from "react";
import { apiPatch, apiPost, ApiError } from "@/lib/fetcher";
import type { Product } from "@/lib/types";
import { fromMinor, toMinor } from "@/lib/money";
import { getCurrencySymbol } from "@/lib/currency";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

type FormState = {
  name: string;
  description: string;
  unitPrice: string; // decimal string, e.g. "49.00"
  taxRatePct: string; // percent string, e.g. "17.5"
};

const EMPTY: FormState = {
  name: "",
  description: "",
  unitPrice: "",
  taxRatePct: "",
};

/** Mirrors productCreateSchema (name 1–160, description ≤1000, unitPrice ≥0, tax 0–1000%). */
function validate(form: FormState) {
  const next: Partial<Record<keyof FormState, string>> = {};
  const name = form.name.trim();
  if (!name) next.name = "Name is required";
  else if (name.length > 160) next.name = "Keep the name under 160 characters";
  if (form.description.length > 1000)
    next.description = "Keep the description under 1000 characters";

  if (form.unitPrice.trim()) {
    const price = parseFloat(form.unitPrice);
    if (Number.isNaN(price) || price < 0)
      next.unitPrice = "Enter a valid price (0 or more)";
  }
  if (form.taxRatePct.trim()) {
    const tax = parseFloat(form.taxRatePct);
    if (Number.isNaN(tax) || tax < 0) next.taxRatePct = "Enter a valid tax percent";
    else if (tax > 1000) next.taxRatePct = "Tax can't exceed 1000%";
  }
  return next;
}

export function ProductFormDialog({
  open,
  onClose,
  product,
  currency = "USD",
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** When provided, the dialog edits this product; otherwise it creates one. */
  product?: Product | null;
  currency?: string;
  onSaved: (product: Product) => void;
}) {
  const { toast } = useToast();
  const isEdit = Boolean(product);
  const symbol = getCurrencySymbol(currency);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        product
          ? {
              name: product.name ?? "",
              description: product.description ?? "",
              unitPrice: product.unitPrice ? String(fromMinor(product.unitPrice)) : "",
              taxRatePct: product.taxRateBps ? String(product.taxRateBps / 100) : "",
            }
          : EMPTY,
      );
      setErrors({});
    }
  }, [open, product]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      unitPrice: toMinor(form.unitPrice || "0"),
      taxRateBps: Math.round((parseFloat(form.taxRatePct || "0") || 0) * 100),
    };

    try {
      const saved = isEdit
        ? await apiPatch<Product>(`/api/products/${product!.id}`, payload)
        : await apiPost<Product>("/api/products", payload);
      toast({
        variant: "success",
        title: isEdit ? "Product updated" : "Product added",
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
          title: "Couldn't save product",
          description: err.message,
        });
      } else {
        toast({ variant: "error", title: "Couldn't save product" });
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
      title={isEdit ? "Edit product" : "New product"}
      description={
        isEdit
          ? "Changes only affect new invoices — existing invoices keep their saved line items."
          : "Save a plan or service once, then add it to invoices in a click."
      }
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" loading={saving}>
            {isEdit ? "Save changes" : "Add product"}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Name" required error={errors.name}>
          {(props) => (
            <Input
              {...props}
              value={form.name}
              invalid={Boolean(errors.name)}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Pro plan — monthly"
              maxLength={160}
            />
          )}
        </Field>

        <Field
          label="Description"
          error={errors.description}
          hint="Optional — shown to your team when picking products"
        >
          {(props) => (
            <Textarea
              {...props}
              value={form.description}
              invalid={Boolean(errors.description)}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Includes priority support and unlimited seats."
              rows={2}
              maxLength={1000}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Monthly price"
            error={errors.unitPrice}
            hint="Flat amount per month"
          >
            {(props) => (
              <Input
                {...props}
                type="text"
                inputMode="decimal"
                prefix={symbol}
                value={form.unitPrice}
                invalid={Boolean(errors.unitPrice)}
                onChange={(e) => set("unitPrice", e.target.value)}
                placeholder="0.00"
                className="text-right tabular"
              />
            )}
          </Field>
          <Field label="Tax %" error={errors.taxRatePct} hint="Applied per line">
            {(props) => (
              <Input
                {...props}
                type="text"
                inputMode="decimal"
                value={form.taxRatePct}
                invalid={Boolean(errors.taxRatePct)}
                onChange={(e) => set("taxRatePct", e.target.value)}
                placeholder="0"
                className="text-right tabular"
              />
            )}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
