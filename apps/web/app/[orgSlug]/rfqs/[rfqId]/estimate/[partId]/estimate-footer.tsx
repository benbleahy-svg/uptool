"use client";

import { getCompletion, setPartStatus } from "@/lib/quoting/partCompletion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@uptool/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  partIds: string[];
  currentPartId: string;
  complete: boolean;
  invalidOpNames: string[];
}

export function EstimateFooter({
  orgSlug,
  rfqParam,
  rfqId,
  partIds,
  currentPartId,
  complete,
  invalidOpNames,
}: Props) {
  const router = useRouter();
  const total = partIds.length;
  const index = Math.max(0, partIds.indexOf(currentPartId));

  const estimateUrl = (pid: string) => `/${orgSlug}/rfqs/${rfqParam}/estimate/${pid}`;
  const overviewUrl = `/${orgSlug}/rfqs/${rfqParam}`;

  function go(targetIndex: number) {
    const pid = partIds[targetIndex];
    if (pid) router.push(estimateUrl(pid));
  }

  // Move to the next part that isn't finalised (completed or no-bid); else exit.
  function advance() {
    const map = getCompletion(rfqId);
    for (let step = 1; step <= total; step++) {
      const pid = partIds[(index + step) % total];
      if (!pid) continue;
      const status = map[pid];
      if (status !== "completed" && status !== "noBid") {
        router.push(estimateUrl(pid));
        return;
      }
    }
    router.push(overviewUrl);
  }

  function onNoBid() {
    setPartStatus(rfqId, currentPartId, "noBid");
    advance();
  }

  function onComplete() {
    setPartStatus(rfqId, currentPartId, "completed");
    advance();
  }

  const tooltipText = invalidOpNames.length
    ? `Error in operations: ${invalidOpNames.join(", ")}`
    : "Error: complete all required fields";

  return (
    <div className="flex flex-none items-center justify-between border-t border-gray-200 bg-white px-5 py-2.5">
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <button
          type="button"
          disabled={index <= 0}
          onClick={() => go(index - 1)}
          aria-label="Previous part"
          className="rounded p-1 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="tabular-nums">
          Part {index + 1} / {total}
        </span>
        <button
          type="button"
          disabled={index >= total - 1}
          onClick={() => go(index + 1)}
          aria-label="Next part"
          className="rounded p-1 transition-colors hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onNoBid}
          className="inline-flex items-center gap-1 text-sm font-medium text-red-500 transition-colors hover:text-red-600"
        >
          No Bid <ChevronRight className="h-4 w-4" />
        </button>

        {complete ? (
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/0.9)]"
          >
            Complete <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <button
                  type="button"
                  disabled
                  className="pointer-events-none inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] opacity-50"
                >
                  Complete <ChevronRight className="h-4 w-4" />
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{tooltipText}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
