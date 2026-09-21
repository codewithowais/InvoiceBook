import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const fieldBase =
  "w-full rounded-lg border bg-surface px-3 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-2 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  invalid?: boolean;
  /** Text/element rendered inside the field on the left (e.g. a currency sign). */
  prefix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, prefix, ...props }, ref) => {
    if (prefix) {
      return (
        <div
          className={cn(
            "flex h-10 items-center rounded-lg border bg-surface shadow-xs transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25",
            invalid
              ? "border-danger focus-within:border-danger focus-within:ring-danger/25"
              : "border-border-strong",
            className,
          )}
        >
          <span className="pl-3 pr-1.5 text-sm text-muted-2 tabular">
            {prefix}
          </span>
          <input
            ref={ref}
            aria-invalid={invalid || undefined}
            className="h-full w-full rounded-r-lg bg-transparent pr-3 text-sm text-foreground placeholder:text-muted-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            {...props}
          />
        </div>
      );
    }
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldBase,
          "h-10",
          invalid
            ? "border-danger focus-visible:border-danger focus-visible:ring-danger/25"
            : "border-border-strong",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
