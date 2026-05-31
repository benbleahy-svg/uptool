"use client";

// Client boundary for the Send page. SendClient owns @react-pdf/renderer (usePDF)
// and is browser-only, so it's loaded with ssr:false — like the estimate viewers.

import type { DocInfo, DocRecipient, DocTemplateSpec } from "@/lib/quoting/quote-doc";
import dynamic from "next/dynamic";
import type { OriginalEmail } from "./send-stub";

const SendClient = dynamic(() => import("./send-client").then((m) => m.SendClient), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#3f4654] text-sm text-gray-300">
      Loading preview…
    </div>
  ),
});

interface Props {
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  rfqNumber: number;
  template: DocTemplateSpec;
  recipient: DocRecipient;
  info: DocInfo;
  customerEmail: string;
  contactName: string;
  original: OriginalEmail;
}

export function SendView(props: Props) {
  return <SendClient {...props} />;
}
