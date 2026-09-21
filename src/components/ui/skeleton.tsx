import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-3",
        "after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-black/[0.04] after:to-transparent after:[animation:shimmer_1.6s_infinite] dark:after:via-white/[0.05]",
        className,
      )}
      {...props}
    />
  );
}

/** A ready-made skeleton for table rows. */
export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="divide-y divide-border" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn(
                "h-4",
                c === 0 ? "w-[22%]" : c === cols - 1 ? "ml-auto w-16" : "w-[14%]",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
