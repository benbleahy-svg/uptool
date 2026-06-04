"use client";

// Session-scoped, cross-component store for per-part completion status, shared
// between the estimate footer and the RFQ sidebar (which live in different
// subtrees). Backed by sessionStorage with a same-tab change event.

import * as React from "react";

export type PartStatus = "completed" | "noBid";
export type CompletionMap = Record<string, PartStatus>;

const EVENT = "estimate:completion-change";
const key = (rfqId: string) => `estimate:completion:${rfqId}`;

export function getCompletion(rfqId: string): CompletionMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(key(rfqId)) ?? "{}") as CompletionMap;
  } catch {
    return {};
  }
}

export function setPartStatus(rfqId: string, partId: string, status: PartStatus | null): void {
  const map = getCompletion(rfqId);
  if (status === null) {
    delete map[partId];
  } else {
    map[partId] = status;
  }
  sessionStorage.setItem(key(rfqId), JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Clear the whole RFQ's completion map (used by Reset estimate). */
export function clearCompletion(rfqId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(key(rfqId));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Reactive read of the completion map; updates on same-tab and cross-tab changes. */
export function usePartCompletion(rfqId: string): CompletionMap {
  const [map, setMap] = React.useState<CompletionMap>({});
  React.useEffect(() => {
    const sync = () => setMap(getCompletion(rfqId));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [rfqId]);
  return map;
}
