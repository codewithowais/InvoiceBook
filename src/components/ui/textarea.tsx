import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        "min-h-[4.5rem] resize-y py-2 leading-relaxed",
        invalid
          ? "border-danger focus-visible:border-danger focus-visible:ring-danger/25"
          : "border-border-strong",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
