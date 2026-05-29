"use client";

import { cn } from "@uptool/ui";
import { ChevronsLeftRight } from "lucide-react";
import * as React from "react";

const STORAGE_KEY = "estimate:split-left-pct";
const MIN_PCT = 25;
const MAX_PCT = 75;
const KEYBOARD_STEP = 2;

function clamp(pct: number) {
  return Math.min(MAX_PCT, Math.max(MIN_PCT, pct));
}

interface Props {
  left: React.ReactNode;
  right: React.ReactNode;
}

export function SplitPane({ left, right }: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const hydrated = React.useRef(false);
  const [leftPct, setLeftPct] = React.useState(50);
  const [dragging, setDragging] = React.useState(false);

  // Restore the divider position for this browser session.
  React.useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const value = Number(saved);
      if (!Number.isNaN(value)) setLeftPct(clamp(value));
    }
    hydrated.current = true;
  }, []);

  React.useEffect(() => {
    if (!hydrated.current) return;
    sessionStorage.setItem(STORAGE_KEY, String(leftPct));
  }, [leftPct]);

  React.useEffect(() => {
    if (!dragging) return;

    function onMove(event: PointerEvent) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      setLeftPct(clamp(((event.clientX - rect.left) / rect.width) * 100));
    }

    function onUp() {
      setDragging(false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full w-full overflow-hidden",
        dragging && "cursor-col-resize select-none",
      )}
    >
      <div className="h-full min-w-0 overflow-hidden" style={{ width: `${leftPct}%` }}>
        {left}
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: an interactive window splitter must be a focusable div, not <hr> */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        aria-valuenow={Math.round(leftPct)}
        aria-valuemin={MIN_PCT}
        aria-valuemax={MAX_PCT}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setLeftPct((p) => clamp(p - KEYBOARD_STEP));
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            setLeftPct((p) => clamp(p + KEYBOARD_STEP));
          } else if (event.key === "Home") {
            event.preventDefault();
            setLeftPct(MIN_PCT);
          } else if (event.key === "End") {
            event.preventDefault();
            setLeftPct(MAX_PCT);
          }
        }}
        className="group relative w-px flex-none cursor-col-resize bg-[hsl(var(--border))] outline-none focus-visible:bg-[hsl(var(--ring))]"
      >
        {/* Hit area widens the grabbable region without changing the visual line. */}
        <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
        <span
          className={cn(
            "absolute left-1/2 top-1/2 flex h-7 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] shadow-sm transition-colors",
            "group-hover:text-[hsl(var(--foreground))]",
            dragging && "text-[hsl(var(--foreground))]",
          )}
        >
          <ChevronsLeftRight className="h-3 w-3" />
        </span>
      </div>

      <div className="h-full min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>
  );
}
