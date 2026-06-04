"use client";

import { clearCompletion } from "@/lib/quoting/partCompletion";
import type { DerivedRfqStatus } from "@/lib/rfq-status";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  buttonVariants,
  cn,
  toast,
} from "@uptool/ui";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { resetEstimate } from "../actions";

interface Props {
  orgSlug: string;
  /** Route segment (rfq number or uuid) used for revalidation paths. */
  rfqParam: string;
  /** Resolved RFQ uuid — passed to the service and the completion store. */
  rfqId: string;
  rfqStatus: DerivedRfqStatus;
}

/** Toolbar action: reset the whole RFQ's estimate (every part). Clears server
 *  state via the service + completion store, then refreshes — the page nulls and
 *  re-stamps estimateHydratedAt, so the calculator remounts with re-seeded
 *  defaults. Sent RFQs require an extra acknowledgement (stronger confirm). */
export function ResetEstimateButton({ orgSlug, rfqParam, rfqId, rfqStatus }: Props) {
  const t = useTranslations("estimate");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [ack, setAck] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const isSent = rfqStatus === "sent";

  async function handleReset() {
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("orgSlug", orgSlug);
      fd.set("rfqParam", rfqParam);
      fd.set("rfqId", rfqId);
      await resetEstimate(fd);
      clearCompletion(rfqId);
      setOpen(false);
      setAck(false);
      router.refresh();
      toast.success(t("reset_toast"));
    } catch {
      toast.error(t("reset_error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setAck(false);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              aria-label={t("reset_tooltip")}
              className="text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
            >
              <RotateCcw className="h-[18px] w-[18px]" />
            </button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("reset_tooltip")}</TooltipContent>
      </Tooltip>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("reset_title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("reset_body")}</AlertDialogDescription>
        </AlertDialogHeader>

        {isSent && (
          <div className="rounded-md border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.06)] p-3 text-sm">
            <p className="text-[hsl(var(--destructive))]">{t("reset_sent_warning")}</p>
            <label className="mt-2 flex items-center gap-2 text-[hsl(var(--foreground))]">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--destructive))]"
              />
              {t("reset_sent_confirm")}
            </label>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("reset_cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || (isSent && !ack)}
            onClick={(e) => {
              e.preventDefault();
              void handleReset();
            }}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {t("reset_confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
