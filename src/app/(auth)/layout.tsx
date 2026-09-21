import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/app-shell/logo";

const HIGHLIGHTS = [
  "Create polished invoices with live totals, tax & discounts",
  "Record payments and keep proof attached — privately",
  "Automate monthly recurring billing on autopilot",
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand / marketing panel */}
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.9]"
          style={{
            background:
              "radial-gradient(120% 90% at 15% 0%, rgba(255,255,255,0.16), transparent 55%), radial-gradient(90% 80% at 100% 100%, rgba(0,0,0,0.28), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />
        <div className="relative">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-primary-fg"
            aria-label="InvoiceBook home"
          >
            <span className="grid size-9 place-items-center rounded-[0.7rem] bg-white/15 ring-1 ring-inset ring-white/25 backdrop-blur">
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
              </svg>
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">
              InvoiceBook
            </span>
          </Link>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-[2.1rem] font-semibold leading-tight text-primary-fg">
            Invoicing that keeps your books honest.
          </h2>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-primary-fg/80">
            A calm, precise workspace for billing customers, tracking every
            payment, and never losing a receipt again.
          </p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-3 text-primary-fg/90">
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0 text-primary-fg/75"
                  aria-hidden
                />
                <span className="text-sm leading-relaxed">{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-fg/60">
          Money handled as exact integer amounts — never rounded floats.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
