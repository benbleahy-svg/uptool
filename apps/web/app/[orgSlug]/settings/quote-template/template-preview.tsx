"use client";

// Live quote-document preview for the settings page. Renders the exact same
// DIN 5008 QuoteDocument used on the Send page, with sample RFQ data, and
// re-renders (debounced) as the user edits template fields. Browser-only
// (@react-pdf/renderer) — loaded with ssr:false from the form.

import { QuoteDocument } from "@/app/[orgSlug]/rfqs/[rfqId]/send/quote-document";
import {
  type DocTemplate,
  SAMPLE_INFO,
  SAMPLE_POSITIONS,
  SAMPLE_RECIPIENT,
} from "@/lib/quoting/quote-doc";
import { usePDF } from "@react-pdf/renderer";
import * as React from "react";

function docFor(template: DocTemplate) {
  return (
    <QuoteDocument
      template={template}
      recipient={SAMPLE_RECIPIENT}
      info={SAMPLE_INFO}
      positions={SAMPLE_POSITIONS}
    />
  );
}

export function TemplatePreview({ template }: { template: DocTemplate }) {
  const [instance, update] = usePDF({ document: docFor(template) });

  // Debounce live updates so we don't re-render the PDF on every keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => update(docFor(template)), 500);
    return () => clearTimeout(id);
  }, [template, update]);

  const ready = !instance.loading && !!instance.url && !instance.error;

  return (
    <div className="overflow-hidden rounded-md border border-[hsl(var(--border))] bg-gray-100">
      {ready ? (
        <iframe
          src={instance.url ?? undefined}
          title="Quote preview"
          className="h-[680px] w-full bg-white"
        />
      ) : (
        <div className="flex h-[680px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
          Rendering preview…
        </div>
      )}
    </div>
  );
}
