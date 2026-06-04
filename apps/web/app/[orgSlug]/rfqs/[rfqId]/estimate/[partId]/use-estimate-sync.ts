"use client";

import { toast } from "@uptool/ui";
import { useTranslations } from "next-intl";
import * as React from "react";

type ActionResult = { ok: true; data: unknown } | { ok: false; error: string };
type Thunk = () => Promise<ActionResult>;

const RETRIES = 3;
const backoffMs = (attempt: number) => 200 * 2 ** attempt; // 200, 400, 800

/**
 * Persistence sync primitive for the estimate calculator.
 *  - `schedule(key, thunk, revert)` debounces 500ms per key; rapid edits to the
 *    same key collapse to one request; distinct keys debounce independently.
 *  - `runNow(thunk, revert)` fires immediately (add / delete / reorder).
 *  - Both retry network failures with exponential backoff (~3 attempts) before
 *    giving up. A handled `{ ok:false }` (e.g. NotFound/validation) does NOT
 *    retry. On give-up or `{ ok:false }`: call `revert()` + toast.
 *  - `saving` is true while any request is in flight (drives the "Saving…" hint).
 * Last-write-wins; no version column (known limitation).
 */
export function useEstimateSync() {
  const t = useTranslations("estimate");
  const [inflight, setInflight] = React.useState(0);
  // Each pending debounce stores its timer + a fire-and-forget flush (used on
  // unmount so a not-yet-fired edit isn't lost when navigating away).
  const timers = React.useRef(
    new Map<string, { id: ReturnType<typeof setTimeout>; fire: () => void }>(),
  );

  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      // Flush on unmount: fire the in-flight edits and swallow any rejection —
      // the component is gone, so there's nothing to revert or surface.
      for (const { id, fire } of pending.values()) {
        clearTimeout(id);
        fire();
      }
      pending.clear();
    };
  }, []);

  const exec = React.useCallback(
    async (thunk: Thunk, revert: () => void) => {
      setInflight((n) => n + 1);
      try {
        let result: ActionResult | undefined;
        for (let attempt = 0; attempt < RETRIES; attempt++) {
          try {
            result = await thunk();
            break; // got a response (ok or handled error) — don't retry
          } catch (err) {
            if (attempt === RETRIES - 1) throw err; // network: exhausted
            await new Promise((r) => setTimeout(r, backoffMs(attempt)));
          }
        }
        if (result && result.ok === false) {
          startTransition(revert);
          toast.error(t("save_failed"));
        }
      } catch {
        startTransition(revert);
        toast.error(t("save_failed"));
      } finally {
        setInflight((n) => n - 1);
      }
    },
    // startTransition is stable (from useTransition) — not a dependency.
    [t],
  );

  const schedule = React.useCallback(
    (key: string, thunk: Thunk, revert: () => void) => {
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing.id);
      // fire-and-forget flush for unmount: persist, but never throw or revert.
      const fire = () => {
        thunk().catch(() => {});
      };
      const id = setTimeout(() => {
        timers.current.delete(key);
        void exec(thunk, revert);
      }, 500);
      timers.current.set(key, { id, fire });
    },
    [exec],
  );

  const runNow = React.useCallback(
    (thunk: Thunk, revert: () => void) => void exec(thunk, revert),
    [exec],
  );

  return { saving: inflight > 0, schedule, runNow };
}
