import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "flex items-center gap-1 text-[0.8125rem] font-medium text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="text-danger" aria-hidden>
          *
        </span>
      ) : null}
    </label>
  ),
);
Label.displayName = "Label";
