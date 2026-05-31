"use client";

// Live quote-document preview for the settings page. Renders the exact same
// server-rendered PDF the Send page uses (one source of truth), with sample RFQ
// data, re-fetching (debounced) as the user edits template fields.

import { fetchQuotePdf } from "@/lib/quoting/fetch-quote-pdf";
import {
  type DocTemplateSpec,
  SAMPLE_INFO,
  SAMPLE_POSITIONS,
  SAMPLE_RECIPIENT,
} from "@/lib/quoting/quote-doc";
import * as React from "react";

export function TemplatePreview({
  orgSlug,
  template,
}: {
  orgSlug: string;
  template: DocTemplateSpec;
}) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    const id = setTimeout(() => {
      fetchQuotePdf({
        orgSlug,
        template,
        recipient: SAMPLE_RECIPIENT,
        info: SAMPLE_INFO,
        positions: SAMPLE_POSITIONS,
      })
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setError(false);
          setUrl(objectUrl);
        })
        .catch(() => !cancelled && setError(true));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(id);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [orgSlug, template]);

  return (
    <div className="overflow-hidden rounded-md border border-[hsl(var(--border))] bg-gray-100">
      {error ? (
        <div className="flex h-[680px] items-center justify-center text-sm text-red-500">
          Failed to render preview.
        </div>
      ) : url ? (
        <iframe src={url} title="Quote preview" className="h-[680px] w-full bg-white" />
      ) : (
        <div className="flex h-[680px] items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
          Rendering preview…
        </div>
      )}
    </div>
  );
}
