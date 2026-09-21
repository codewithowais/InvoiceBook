import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("size-5 animate-spin text-muted-2", className)}
      aria-hidden
    />
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-sm text-muted"
    >
      <Spinner className="size-6 text-primary" />
      <span>{label}</span>
    </div>
  );
}
