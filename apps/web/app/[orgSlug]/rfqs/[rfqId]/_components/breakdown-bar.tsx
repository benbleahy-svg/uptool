"use client";

import type { BreakdownKey, BreakdownSegment } from "@/lib/quoting/estimateTotals";
import { formatAmount } from "@/lib/quoting/materialCost";
import { Tooltip, TooltipContent, TooltipTrigger, cn } from "@uptool/ui";

// Shared price-breakdown bar. Used by the estimate per-part hover (Prompt 4) and
// the quote selected-totals summary. Takes generic segments.
const SEGMENT_BG: Record<BreakdownKey, string> = {
  materials: "bg-green-300",
  nr: "bg-amber-300",
  recurring: "bg-blue-300",
  outside: "bg-rose-300",
  purchased: "bg-violet-300",
};

const AXIS_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function BreakdownBar({
  segments,
  totalTimeHr,
  className,
}: {
  segments: BreakdownSegment[];
  totalTimeHr?: number;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Cumulative offsets for the staggered stacked bar.
  let offset = 0;
  const rows = segments.map((seg) => {
    const pct = total > 0 ? (seg.value / total) * 100 : 0;
    const row = { ...seg, pct, start: offset };
    offset += pct;
    return row;
  });

  return (
    <div className={cn("w-[30rem] max-w-[80vw] text-sm", className)}>
      {totalTimeHr !== undefined && (
        <div className="text-gray-500">
          Total Time: <span className="font-bold text-gray-900">{totalTimeHr.toFixed(2)} hr</span>
        </div>
      )}
      <div className={cn("text-gray-500", totalTimeHr !== undefined && "mt-0.5")}>
        Total Price Breakdown:
      </div>

      <div className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <Tooltip key={row.key}>
            <TooltipTrigger asChild>
              <div className="relative h-6 cursor-default overflow-hidden">
                <div
                  className={cn("absolute top-0 h-6 rounded-sm", SEGMENT_BG[row.key])}
                  style={{ left: `${row.start}%`, width: `${Math.max(row.pct, 0.5)}%` }}
                />
                <div
                  className="absolute top-0 flex h-6 items-center whitespace-nowrap px-1 text-xs text-gray-900"
                  style={{ left: `${row.start}%` }}
                >
                  <span className="font-bold">{Math.round(row.pct)}%</span>
                  <span className="ml-1">
                    {row.shortLabel} ({formatAmount(row.value)} €)
                  </span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              {Math.round(row.pct)}% {row.fullLabel} ({formatAmount(row.value)} €)
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="relative mt-2 h-4">
        {AXIS_TICKS.map((tick) => (
          <span
            key={tick}
            className="absolute top-0 -translate-x-1/2 text-[10px] text-gray-400"
            style={{ left: `${tick}%` }}
          >
            {tick}%
          </span>
        ))}
      </div>
    </div>
  );
}
