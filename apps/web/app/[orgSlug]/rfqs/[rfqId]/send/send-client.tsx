"use client";

// Fetches the server-rendered quote PDF (one source of truth) and shares that
// single blob across the preview, Download, Print, and the email attachment.
// Reads the quote positions from the client snapshot; everything else comes from
// the server-provided spec. Handles the stubbed send + the confirmation card.

import { fetchQuotePdf } from "@/lib/quoting/fetch-quote-pdf";
import {
  type DocInfo,
  type DocRecipient,
  type DocTemplateSpec,
  positionsFromSnapshot,
} from "@/lib/quoting/quote-doc";
import { getQuoteSnapshot, markQuoteSent } from "@/lib/quoting/quote-store";
import { useRouter } from "next/navigation";
import * as React from "react";
import { buildDefaultSnapshot } from "../quote/quote-state";
import { EmailComposer, type SendPayload } from "./email-composer";
import { QuotePdfPane } from "./quote-pdf-pane";
import type { OriginalEmail } from "./send-stub";

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
  const [snapshot] = React.useState(
    () => getQuoteSnapshot(rfqId) ?? buildDefaultSnapshot(rfqNumber),
  );
  const [submitted, setSubmitted] = React.useState(false);
  const [pdf, setPdf] = React.useState<{ url: string; blob: Blob } | null>(null);
  const [pdfError, setPdfError] = React.useState(false);
  const startedRef = React.useRef(false);
  const urlRef = React.useRef<string | null>(null);

  // Render the PDF once on the server; reuse the one blob everywhere (preview,
  // Download, Print, email attachment). startedRef makes this a single fetch even
  // under React StrictMode's double-invoke; the data is stable for the page life.
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    fetchQuotePdf({
      orgSlug,
      template,
      recipient,
      info,
      positions: positionsFromSnapshot(snapshot),
    })
      .then((blob) => {
        urlRef.current = URL.createObjectURL(blob);
        setPdf({ url: urlRef.current, blob });
      })
      .catch(() => setPdfError(true));
  }, [orgSlug, template, recipient, info, snapshot]);

  // Revoke the object URL on unmount only — never on re-render.
  React.useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const downloadName = `${template.companyName} Quote ${info.quoteNo} ${info.dateISO.slice(0, 10)}.pdf`;
  const attachmentName = `${template.companyName} Quote ${info.quoteNo}`;

  function handleSend(payload: SendPayload) {
    // Stub: log the reply payload (incl. the server-rendered PDF). Real email
    // send is a later epic and will attach this same PDF.
    console.log("[send quote] reply on thread", {
      thread: original.replyFromEmail,
      ...payload,
      attachmentBytes: pdf?.blob.size ?? 0,
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
          url={pdf?.url ?? null}
          loading={!pdf && !pdfError}
          error={pdfError}
          quoteLabel={info.quoteNo}
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
