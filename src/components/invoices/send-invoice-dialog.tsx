"use client";

import { useState } from "react";
import { ExternalLink, Mail } from "lucide-react";
import { apiPost, ApiError } from "@/lib/fetcher";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

type SendResponse = { sentAt: string; to: string; previewUrl?: string };

export function SendInvoiceDialog({
  open,
  onClose,
  invoiceId,
  invoiceNumber,
  customerEmail,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  customerEmail: string | null;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Reset the form each time the dialog transitions to open — done during
  // render (React's documented pattern) rather than in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMessage("");
      setSending(false);
      setPreview(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await apiPost<SendResponse>(`/api/invoices/${invoiceId}/send`, {
        message: message.trim() || null,
      });
      onSent();
      toast({
        variant: "success",
        title: "Invoice sent",
        description: `Emailed to ${res.to}.`,
      });
      if (res.previewUrl) {
        // Dev/test inbox: keep the dialog open so the user can view the email.
        setPreview(res.previewUrl);
      } else {
        onClose();
      }
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't send",
        description:
          err instanceof ApiError ? err.message : "The email failed to send.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!sending}
      title={`Send invoice ${invoiceNumber}`}
      description={
        customerEmail
          ? `The PDF will be emailed to ${customerEmail}.`
          : "This customer has no email address on file."
      }
      footer={
        preview ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="send-form"
              loading={sending}
              disabled={!customerEmail}
            >
              <Mail className="size-4" aria-hidden />
              Send email
            </Button>
          </>
        )
      }
    >
      {preview ? (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            This used a free test inbox, so the email wasn&apos;t delivered to a
            real address. Open the preview to see exactly what the customer would
            receive:
          </p>
          <a
            href={preview}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-primary transition-colors hover:border-primary/40"
          >
            <ExternalLink className="size-4" aria-hidden />
            View the sent email
          </a>
          <p className="text-xs text-muted-2">
            Configure SMTP credentials in your environment for real delivery.
          </p>
        </div>
      ) : (
        <form id="send-form" onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Message"
            hint="Optional — added above the invoice summary."
          >
            {(props) => (
              <Textarea
                {...props}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Thanks for your business — payment details are on the attached invoice."
              />
            )}
          </Field>
        </form>
      )}
    </Dialog>
  );
}
