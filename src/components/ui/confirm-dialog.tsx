"use client";

import { useState } from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  /** Extra body content (e.g. a required reason field). */
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  children,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    try {
      setPending(true);
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      dismissible={!pending}
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={pending}
            type="button"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            loading={pending}
            type="button"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children ?? (
        <p className="text-sm text-muted">
          This action will be applied immediately.
        </p>
      )}
    </Dialog>
  );
}
