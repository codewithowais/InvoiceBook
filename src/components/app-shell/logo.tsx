import { cn } from "@/lib/utils";

/** InvoiceBook mark: a stacked "ledger" glyph with a flowing underline. */
export function Logo({
  className,
  withWordmark = true,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-primary text-primary-fg shadow-sm ring-1 ring-inset ring-white/10">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-5"
          aria-hidden
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 3.5h9.5a2 2 0 0 1 2 2V19l-2.2-1.4-2.3 1.4-2.3-1.4L8.2 19 6 17.6V3.5Z" />
          <path d="M9.2 8h5.2M9.2 11.3h5.2" />
          <path d="M3.5 21c2.4 0 2.4-2 4.8-2s2.4 2 4.8 2 2.4-2 4.8-2 2.4 2 4.8 2" opacity="0.55" />
        </svg>
      </span>
      {withWordmark ? (
        <span className="font-display text-[1.15rem] font-semibold leading-none tracking-tight text-foreground">
          Invoice<span className="text-primary">Book</span>
        </span>
      ) : null}
    </span>
  );
}
