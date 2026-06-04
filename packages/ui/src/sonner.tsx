"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

/** App toast host — mount once near the root. Thin wrapper over sonner so the
 *  rest of the app imports toast UI from @uptool/ui, not the library directly. */
function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return <SonnerToaster position="bottom-right" {...props} />;
}

export { Toaster, toast };
