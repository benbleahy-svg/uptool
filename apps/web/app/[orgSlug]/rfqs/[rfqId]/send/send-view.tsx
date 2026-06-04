"use client";

// Client boundary for the Send page. SendClient renders the PDF preview with
// pdf.js (react-pdf), browser-only → ssr:false (like the estimate viewers).

import dynamic from "next/dynamic";

const SendClient = dynamic(() => import("./send-client").then((m) => m.SendClient), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#3f4654] text-sm text-gray-300">
      Loading preview…
    </div>
  ),
});

export interface SendViewProps {
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  quoteId: string;
  quoteNumber: number;
  status: string;
  sentAtISO: string | null;
  hasSentQuote: boolean;
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
}

export function SendView(props: SendViewProps) {
  return <SendClient {...props} />;
}
