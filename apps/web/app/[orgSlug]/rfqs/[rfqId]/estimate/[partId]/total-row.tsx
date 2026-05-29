"use client";

import { computeTotals } from "@/lib/quoting/estimateTotals";
import type { MaterialCard } from "@/lib/quoting/materialCost";
import { formatAmount } from "@/lib/quoting/materialCost";
import type { Operation } from "@/lib/quoting/operationCost";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@uptool/ui";
import { ChevronsUpDown } from "lucide-react";
import { PriceBreakdown } from "./price-breakdown";
import { QTY_COL_W, ROW_ICON_W } from "./pricing-layout";

interface Props {
  materials: MaterialCard[];
  operations: Operation[];
  quantities: number[];
}

export function TotalRow({ materials, operations, quantities }: Props) {
  return (
    <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-gray-200 bg-white px-5 py-2.5">
      <LinkFilesDialog />

      <div className="ml-auto flex items-stretch">
        <div className="flex flex-col justify-center pr-2 text-right text-xs font-medium">
          <div className="leading-5 text-gray-900">Total</div>
          <div className="leading-5 text-gray-400">Unit</div>
        </div>

        {quantities.map((qty, index) => {
          const { total, perUnit } = computeTotals(materials, operations, qty);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: pricing columns are positional
            <div key={index} style={{ width: QTY_COL_W }} className="px-2">
              <PriceHover materials={materials} operations={operations} qty={qty}>
                <button
                  type="button"
                  className="block w-full text-right text-sm font-semibold leading-5 text-gray-900 tabular-nums"
                >
                  {formatAmount(total)} <span className="text-gray-400">€</span>
                </button>
              </PriceHover>
              <PriceHover materials={materials} operations={operations} qty={qty}>
                <button
                  type="button"
                  className="block w-full text-right text-sm leading-5 text-gray-500 tabular-nums"
                >
                  {formatAmount(perUnit)} <span className="text-gray-400">€</span>
                </button>
              </PriceHover>
            </div>
          );
        })}

        <div style={{ width: ROW_ICON_W }} />
      </div>
    </div>
  );
}

function PriceHover({
  materials,
  operations,
  qty,
  children,
}: {
  materials: MaterialCard[];
  operations: Operation[];
  qty: number;
  children: React.ReactNode;
}) {
  return (
    <HoverCard openDelay={150} closeDelay={0}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="end" side="top" className="w-auto p-4">
        <PriceBreakdown materials={materials} operations={operations} qty={qty} />
      </HoverCardContent>
    </HoverCard>
  );
}

function LinkFilesDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
        >
          Link additional files
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Link additional files</DialogTitle>
        <DialogDescription>Coming soon — attach reference files to this part.</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
