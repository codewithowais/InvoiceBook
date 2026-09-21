import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Consistent money rendering. ALWAYS use this (or formatMoney) — never format
 * minor units by hand. Uses tabular figures so columns align.
 */
export function Amount({
  value,
  currency,
  className,
  muted,
  emphasis,
}: {
  value: number;
  currency: string;
  className?: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <span
      className={cn(
        "tabular",
        emphasis && "font-semibold",
        muted && "text-muted",
        className,
      )}
    >
      {formatMoney(value, currency)}
    </span>
  );
}
