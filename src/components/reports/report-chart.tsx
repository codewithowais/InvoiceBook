"use client";

import { useId, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { ReportMonth } from "./types";

/*
 * Month-by-month billed vs collected, drawn as an accessible grouped bar
 * chart in inline SVG (no chart library).
 *
 * Colours are a two-series categorical pair matched to the "Mist" theme:
 *   billed = steel-blue (the brand primary), collected = muted gold.
 * Blue vs amber is the most colourblind-safe categorical pairing, and both
 * stay calm/low-chroma to fit the theme. Identity is never colour-alone: a
 * legend + hover tooltip + a "table view" back it up.
 */

const SERIES_CSS = `
.r-chart-scope {
  --r-billed: #4f7bb0;
  --r-collected: #bd8a3c;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .r-chart-scope {
    --r-billed: #7f9ec9;
    --r-collected: #d0a24e;
  }
}
:root[data-theme="dark"] .r-chart-scope {
  --r-billed: #7f9ec9;
  --r-collected: #d0a24e;
}
`;

// Logical viewBox — the SVG scales responsively to its container width.
const W = 760;
const H = 320;
const M = { top: 16, right: 16, bottom: 44, left: 60 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;
const BASELINE = M.top + PLOT_H;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  let step: number;
  if (n <= 1) step = 1;
  else if (n <= 2) step = 2;
  else if (n <= 2.5) step = 2.5;
  else if (n <= 5) step = 5;
  else step = 10;
  return step * pow;
}

function monthLabel(month: string, isYearStart: boolean): string {
  const [y, m] = month.split("-").map(Number);
  const short = new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "short",
  });
  return isYearStart ? `${short} ’${String(y).slice(2)}` : short;
}

export function ReportChart({
  data,
  currency,
}: {
  data: ReportMonth[];
  currency: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const descId = useId();

  const n = Math.max(1, data.length);
  const maxVal = niceMax(
    Math.max(1, ...data.map((d) => Math.max(d.billed, d.collected))),
  );

  const groupW = PLOT_W / n;
  const innerPad = groupW * 0.16;
  const gap = 2; // 2px surface gap between the two fills
  const barsArea = groupW - innerPad * 2;
  const barW = Math.min((barsArea - gap) / 2, 42);
  const pairW = barW * 2 + gap;

  const y = (value: number) => BASELINE - (value / maxVal) * PLOT_H;
  const groupStart = (i: number) => M.left + i * groupW;
  const groupCenter = (i: number) => groupStart(i) + groupW / 2;

  // Y gridlines / ticks (0, 25, 50, 75, 100%).
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    v: maxVal * f,
    yPos: BASELINE - f * PLOT_H,
  }));

  const compact = (minor: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(minor / 100);

  const totalBilled = data.reduce((s, d) => s + d.billed, 0);
  const totalCollected = data.reduce((s, d) => s + d.collected, 0);
  const rangeDesc = data.length
    ? `${monthLabel(data[0].month, false)} to ${monthLabel(
        data[data.length - 1].month,
        false,
      )}`
    : "the selected range";

  const activeRow = active != null ? data[active] : null;

  return (
    <div className="r-chart-scope">
      <style dangerouslySetInnerHTML={{ __html: SERIES_CSS }} />

      {/* Legend — carries series identity without relying on colour alone. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1">
        <LegendSwatch color="var(--r-billed)" label="Billed" />
        <LegendSwatch color="var(--r-collected)" label="Collected" />
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-auto w-full"
          onMouseLeave={() => setActive(null)}
        >
          <title id={titleId}>Billed versus collected by month</title>
          <desc id={descId}>
            {`Grouped bar chart comparing amount billed and amount collected each month over ${rangeDesc}. Total billed ${formatMoney(
              totalBilled,
              currency,
            )}; total collected ${formatMoney(totalCollected, currency)}.`}
          </desc>

          {/* Gridlines + y-axis tick labels */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={M.left}
                x2={M.left + PLOT_W}
                y1={t.yPos}
                y2={t.yPos}
                style={{ stroke: "var(--border)" }}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={M.left - 8}
                y={t.yPos}
                textAnchor="end"
                dominantBaseline="middle"
                style={{ fill: "var(--muted-2)" }}
                className="tabular"
                fontSize={11}
              >
                {compact(t.v)}
              </text>
            </g>
          ))}

          {/* Baseline */}
          <line
            x1={M.left}
            x2={M.left + PLOT_W}
            y1={BASELINE}
            y2={BASELINE}
            style={{ stroke: "var(--border-strong)" }}
            strokeWidth={1}
            shapeRendering="crispEdges"
          />

          {/* Bars + hover hit areas + month labels */}
          {data.map((d, i) => {
            const cx = groupCenter(i);
            const pairStart = cx - pairW / 2;
            const billedH = Math.max(0, BASELINE - y(d.billed));
            const collectedH = Math.max(0, BASELINE - y(d.collected));
            const isActive = active === i;
            const yearStart = d.month.endsWith("-01") || i === 0;
            return (
              <g key={d.month}>
                {/* Hover hit target spanning the whole column */}
                <rect
                  x={groupStart(i)}
                  y={M.top}
                  width={groupW}
                  height={PLOT_H}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onMouseMove={() => setActive(i)}
                />
                {isActive ? (
                  <rect
                    x={groupStart(i)}
                    y={M.top}
                    width={groupW}
                    height={PLOT_H}
                    style={{ fill: "var(--muted-2)" }}
                    opacity={0.06}
                    pointerEvents="none"
                  />
                ) : null}

                {d.billed > 0 ? (
                  <rect
                    x={pairStart}
                    y={y(d.billed)}
                    width={barW}
                    height={billedH}
                    rx={4}
                    ry={4}
                    style={{ fill: "var(--r-billed)" }}
                    opacity={active == null || isActive ? 1 : 0.55}
                    pointerEvents="none"
                  />
                ) : null}
                {d.collected > 0 ? (
                  <rect
                    x={pairStart + barW + gap}
                    y={y(d.collected)}
                    width={barW}
                    height={collectedH}
                    rx={4}
                    ry={4}
                    style={{ fill: "var(--r-collected)" }}
                    opacity={active == null || isActive ? 1 : 0.55}
                    pointerEvents="none"
                  />
                ) : null}

                <text
                  x={cx}
                  y={BASELINE + 16}
                  textAnchor="middle"
                  style={{ fill: "var(--muted)" }}
                  fontSize={11}
                  pointerEvents="none"
                >
                  {monthLabel(d.month, yearStart)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* HTML tooltip overlay, positioned over the active column */}
        {activeRow ? (
          <div
            className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md"
            style={{
              left: `${(groupCenter(active as number) / W) * 100}%`,
            }}
          >
            <p className="mb-1 font-semibold text-foreground">
              {monthLabel(activeRow.month, true)}
            </p>
            <p className="flex items-center justify-between gap-3 text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-[2px]"
                  style={{ background: "var(--r-billed)" }}
                />
                Billed
              </span>
              <span className="tabular font-medium text-foreground">
                {formatMoney(activeRow.billed, currency)}
              </span>
            </p>
            <p className="mt-0.5 flex items-center justify-between gap-3 text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-[2px]"
                  style={{ background: "var(--r-collected)" }}
                />
                Collected
              </span>
              <span className="tabular font-medium text-foreground">
                {formatMoney(activeRow.collected, currency)}
              </span>
            </p>
          </div>
        ) : null}
      </div>

      {/* Accessible table alternative to the visual chart */}
      <details className="mt-4 rounded-lg border border-border bg-surface-2">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground">
          View as table
        </summary>
        <div className="w-full overflow-x-auto border-t border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-muted-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  Month
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  Billed
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  Collected
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((d) => (
                <tr key={d.month}>
                  <td className="px-4 py-2 text-foreground">
                    {monthLabel(d.month, true)}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground tabular">
                    {formatMoney(d.billed, currency)}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground tabular">
                    {formatMoney(d.collected, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted">
      <span
        aria-hidden
        className="size-3 rounded-[3px]"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
