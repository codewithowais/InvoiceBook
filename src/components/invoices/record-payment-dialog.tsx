"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { apiPost, uploadFile, ApiError } from "@/lib/fetcher";
import { formatMoney, toMinor, fromMinor } from "@/lib/money";
import { toISODate } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/invoice-ui";
import type { PaymentMethod } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { getCurrencySymbol } from "@/lib/currency";

const ACCEPTED = ["image/png", "image/jpeg", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;

export function RecordPaymentDialog({
  open,
  onClose,
  invoiceId,
  currency,
  outstanding,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  currency: string;
  outstanding: number; // minor units
  onRecorded: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(toISODate(new Date()));
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(outstanding > 0 ? String(fromMinor(outstanding)) : "");
      setPaidAt(toISODate(new Date()));
      setMethod("bank_transfer");
      setReference("");
      setFile(null);
      setErrors({});
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open, outstanding]);

  function pickFile(f: File | null) {
    if (!f) {
      setFile(null);
      return;
    }
    if (!ACCEPTED.includes(f.type)) {
      setErrors((e) => ({
        ...e,
        file: "Only PNG, JPG or PDF files are allowed.",
      }));
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setErrors((e) => ({ ...e, file: "File must be 10 MB or smaller." }));
      setFile(null);
      return;
    }
    setErrors((e) => ({ ...e, file: "" }));
    setFile(f);
  }

  function validate() {
    const next: Record<string, string> = {};
    const minor = toMinor(amount || "0");
    if (!amount || minor <= 0) next.amount = "Enter an amount greater than zero";
    else if (minor > outstanding)
      next.amount = `Can't exceed the ${formatMoney(outstanding, currency)} balance`;
    if (!paidAt) next.paidAt = "Payment date is required";
    if (!file) next.file = "Attach proof of payment (image or PDF)";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !file) return;
    setSaving(true);
    try {
      const upload = await uploadFile("/api/uploads/proof", file);
      await apiPost(`/api/invoices/${invoiceId}/payments`, {
        amount: toMinor(amount),
        method,
        paidAt,
        reference: reference.trim() || null,
        proofBlobKey: upload.blobKey,
        proofFileName: upload.fileName,
        proofContentType: upload.contentType,
      });
      toast({
        variant: "success",
        title: "Payment recorded",
        description: `${formatMoney(toMinor(amount), currency)} received.`,
      });
      onRecorded();
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Couldn't record the payment.";
      if (err instanceof ApiError && err.status === 422) {
        setErrors((p) => ({ ...p, ...err.fieldErrors() }));
      }
      toast({ variant: "error", title: "Payment failed", description: message });
    } finally {
      setSaving(false);
    }
  }

  const symbol = getCurrencySymbol(currency);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!saving}
      title="Record payment"
      description={`${formatMoney(outstanding, currency)} outstanding on this invoice.`}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" loading={saving}>
            Record payment
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount received" required error={errors.amount}>
            {(props) => (
              <Input
                {...props}
                type="text"
                inputMode="decimal"
                prefix={symbol}
                value={amount}
                invalid={Boolean(errors.amount)}
                onChange={(e) => setAmount(e.target.value)}
                className="text-right tabular"
                placeholder="0.00"
              />
            )}
          </Field>
          <Field label="Payment date" required error={errors.paidAt}>
            {(props) => (
              <Input
                {...props}
                type="date"
                value={paidAt}
                invalid={Boolean(errors.paidAt)}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Method" required>
            {(props) => (
              <Select
                {...props}
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reference" hint="Optional txn / cheque no.">
            {(props) => (
              <Input
                {...props}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="TXN-48213"
              />
            )}
          </Field>
        </div>

        {/* Proof upload */}
        <div>
          <Label className="mb-1.5" required>
            Proof of payment
          </Label>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            id="proof-file"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
              <span className="grid size-9 place-items-center rounded-md bg-primary-soft text-primary-soft-fg">
                {file.type === "application/pdf" ? (
                  <FileText className="size-4" aria-hidden />
                ) : (
                  <ImageIcon className="size-4" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {file.name}
                </p>
                <p className="text-xs text-muted-2">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => pickFile(null)}
                aria-label="Remove file"
                className="rounded-md p-1 text-muted-2 hover:text-danger"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <label
              htmlFor="proof-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong bg-surface-2 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-surface-3"
            >
              <Paperclip className="size-5 text-muted-2" aria-hidden />
              <span className="text-sm font-medium text-foreground">
                Click to attach a receipt
              </span>
              <span className="text-xs text-muted-2">PNG, JPG or PDF · up to 10 MB</span>
            </label>
          )}
          {errors.file ? (
            <p role="alert" className="mt-1 text-xs font-medium text-danger">
              {errors.file}
            </p>
          ) : null}
        </div>
      </form>
    </Dialog>
  );
}
