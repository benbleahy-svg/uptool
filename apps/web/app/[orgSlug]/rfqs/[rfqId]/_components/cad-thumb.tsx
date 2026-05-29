import { cn } from "@uptool/ui";
import { Box } from "lucide-react";

/**
 * Placeholder CAD thumbnail. A real `online-3d-viewer` render would need one
 * WebGL context per thumbnail — too many on a list page — so the overview uses
 * this lightweight dummy. Swap for a live render later if needed.
 */
export function CadThumb({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-400",
        className,
      )}
    >
      <Box className="h-1/2 w-1/2" strokeWidth={1} />
    </div>
  );
}
