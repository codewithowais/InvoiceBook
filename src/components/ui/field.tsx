import { useId } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  /**
   * Render-prop that receives the ids to wire to the control, so labels,
   * hints and errors are correctly associated for screen readers.
   */
  children: (props: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
}

export function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      ) : null}
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
