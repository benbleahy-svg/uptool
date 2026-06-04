"use client";

// The estimate calculator's persistence-sync hook. Generalised into the shared
// useRecordSync (apps/web/lib/use-record-sync.ts); this wrapper just binds the
// estimate-namespace fail-toast string so the calculator's call site is unchanged.

import { useRecordSync } from "@/lib/use-record-sync";
import { useTranslations } from "next-intl";

export function useEstimateSync() {
  const t = useTranslations("estimate");
  return useRecordSync(t("save_failed"));
}
