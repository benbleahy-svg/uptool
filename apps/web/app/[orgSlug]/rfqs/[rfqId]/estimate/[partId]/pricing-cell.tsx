import { formatAmount } from "@/lib/quoting/materialCost";
import { cn } from "@uptool/ui";
import { QTY_COL_W } from "./pricing-layout";

/** One per-qty pricing column: total (top, bold) over per-unit (bottom, muted).
 *  `blue` marks a manually-overridden column (matches the override styling). */
export function PricingCell({
  total,
  perUnit,
  blue,
}: { total: number; perUnit: number; blue?: boolean }) {
  return (
    <div style={{ width: QTY_COL_W }} className="px-2 text-right text-sm tabular-nums">
      <div className={cn("font-semibold", blue ? "text-blue-600" : "text-gray-900")}>
        {formatAmount(total)} <span className="text-gray-400">€</span>
      </div>
      <div className={cn(blue ? "text-blue-600" : "text-gray-500")}>
        {formatAmount(perUnit)} <span className="text-gray-400">€</span>
      </div>
    </div>
  );
}

/** Blank column placeholder (keeps alignment when a row has no pricing yet). */
export function EmptyPricingCell() {
  return <div style={{ width: QTY_COL_W }} />;
}
