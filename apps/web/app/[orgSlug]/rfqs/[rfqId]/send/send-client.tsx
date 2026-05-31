"use client";

// Owns the single quote-PDF render (usePDF) so the preview and the composer's
// auto-attachment share one document. Loaded with ssr:false (see send-view).
// Handles the stubbed send + the "Quote Complete" confirmation.

import { type DocInfo, type DocRecipient, type DocTemplate, positionsFromSnapshot } from "@/lib/quoting/quote-doc";
import { getQuoteSnapshot, markQuoteSent } from "@/lib/quoting/quote-store";
import { usePDF } from "@react-pdf/renderer";
import { useRouter } from "next/navigation";
import * as React from "react";
import { buildDefaultSnapshot } from "../quote/quote-state";
import { EmailComposer, type SendPayload } from "./email-composer";
import { QuoteDocument } from "./quote-document";
import { QuotePdfPane } from "./quote-pdf-pane";
import type { OriginalEmail } from "./send-stub";

interface Props {
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  rfqNumber: number;
  template: DocTemplate;
  recipient: DocRecipient;
  info: DocInfo;
  customerEmail: string;
  contactName: string;
  original: OriginalEmail;
}

export function SendClient({
  orgSlug,
  rfqParam,
  rfqId,
  rfqNumber,
  template,
  recipient,
  info,
  customerEmail,
  contactName,
  original,
}: Props) {
  const router = useRouter();
  // ssr:false → sessionStorage is available; read the saved quote or fall back.
  const [snapshot] = React.useState(
    () => getQuoteSnapshot(rfqId) ?? buildDefaultSnapshot(rfqNumber),
  );
  const [submitted, setSubmitted] = React.useState(false);

  const positions = React.useMemo(() => positionsFromSnapshot(snapshot), [snapshot]);

  const [instance] = usePDF({
    document: (
      <QuoteDocument
        template={template}
        recipient={recipient}
        info={info}
        positions={positions}
      />
    ),
  });

  const downloadName = `${template.companyName} Quote ${info.quoteNo} ${info.dateISO.slice(0, 10)}.pdf`;
  const attachmentName = `${template.companyName} Quote ${info.quoteNo}`;

  function handleSend(payload: SendPayload) {
    // Stub: log the reply payload (incl. the rendered PDF). Real email send is a
    // later epic — see quoteService.send.
    console.log("[send quote] reply on thread", {
      thread: original.replyFromEmail,
      ...payload,
      attachmentBytes: instance.blob?.size ?? 0,
    });
    markQuoteSent(rfqId, new Date().toISOString());
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <QuoteCompleteCard
        rfqNumber={rfqNumber}
        onViewRfq={() => router.push(`/${orgSlug}/rfqs/${rfqParam}`)}
        onRevise={() => router.push(`/${orgSlug}/rfqs/${rfqParam}/quote`)}
      />
    );
  }

  return (
    <div className="flex h-full">
      {/* Equal-width panes: preview | composer */}
      <div className="min-w-0 flex-1 basis-1/2">
        <QuotePdfPane
          instance={instance}
          quoteNumber={snapshot.quoteNumber}
          downloadName={downloadName}
        />
      </div>
      <aside className="min-w-0 flex-1 basis-1/2 border-l border-gray-200">
        <EmailComposer
          original={original}
          customerEmail={customerEmail}
          contactName={contactName}
          quoteNumber={snapshot.quoteNumber}
          attachmentName={attachmentName}
          onSend={handleSend}
        />
      </aside>
    </div>
  );
}

function QuoteCompleteCard({
  rfqNumber,
  onViewRfq,
  onRevise,
}: {
  rfqNumber: number;
  onViewRfq: () => void;
  onRevise: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-[hsl(210_20%_96%)] p-8">
      <div className="w-[360px] rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Quote Complete</h2>
        {/* "QUOTED" graphic — placeholder until a real asset is supplied */}
        <div className="relative mt-4 flex h-40 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-gray-600 to-gray-900">
          <span className="select-none text-4xl font-black tracking-[0.2em] text-white/15">
            QUOTED
          </span>
        </div>
        <p className="mt-4 font-semibold text-gray-900">RFQ {rfqNumber}</p>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onViewRfq}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            View RFQ Detail
          </button>
          <button
            type="button"
            onClick={onRevise}
            className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
          >
            Revise Quote
          </button>
        </div>
      </div>
    </div>
  );
}
