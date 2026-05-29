import { formatAmount } from "@/lib/quoting/materialCost";
import { QTY_COL_W } from "./pricing-layout";

/** One per-qty pricing column: total (top, bold) over per-unit (bottom, muted). */
export function PricingCell({ total, perUnit }: { total: number; perUnit: number }) {
  return (
    <div style={{ width: QTY_COL_W }} className="px-2 text-right text-sm tabular-nums">
      <div className="font-semibold text-gray-900">
        {formatAmount(total)} <span className="text-gray-400">€</span>
      </div>
      <div className="text-gray-500">
        {formatAmount(perUnit)} <span className="text-gray-400">€</span>
      </div>
    </div>
  );
}

/** Blank column placeholder (keeps alignment when a row has no pricing yet). */
export function EmptyPricingCell() {
  return <div style={{ width: QTY_COL_W }} />;
}
