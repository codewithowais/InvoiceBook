import { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "subtle";
type Variant = ButtonVariant;
export type ButtonSize = "sm" | "md" | "lg" | "icon";
type Size = ButtonSize;

const base =
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[background,color,box-shadow,border,transform] duration-150 disabled:pointer-events-none disabled:opacity-55 active:translate-y-px select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-fg shadow-xs hover:bg-primary-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
  secondary:
    "bg-surface-3 text-foreground hover:bg-border border border-border-strong/60",
  outline:
    "border border-border-strong bg-surface text-foreground hover:bg-surface-2 hover:border-muted-2/60",
  ghost: "text-foreground hover:bg-surface-3",
  subtle: "bg-primary-soft text-primary-soft-fg hover:brightness-[0.97]",
  danger: "bg-danger text-white hover:bg-danger-hover shadow-xs",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[0.9375rem]",
  icon: "h-10 w-10 p-0",
};

export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : null}
        <span
          className={cn(
            "inline-flex items-center gap-2",
            loading && "opacity-90",
          )}
        >
          {children}
        </span>
      </button>
    );
  },
);
Button.displayName = "Button";

export interface ButtonLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: Variant;
  size?: Size;
}

/** A Next.js Link styled exactly like a Button (for navigation actions). */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ className, variant = "primary", size = "md", href, children, ...props }, ref) => (
    <Link
      ref={ref}
      href={href}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {children}
    </Link>
  ),
);
ButtonLink.displayName = "ButtonLink";
