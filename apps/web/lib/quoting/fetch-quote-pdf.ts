"use client";

import type { QuotePdfRequest } from "./quote-doc";

/**
 * POST a quote spec to the server render endpoint and return the rendered PDF
 * blob. The single client entry point for the DIN 5008 quote PDF — used by the
 * Send-page preview/Download/Print, the email attachment, and the settings live
 * preview, so they all share one (server) source of truth.
 */
export async function fetchQuotePdf(request: QuotePdfRequest): Promise<Blob> {
  const res = await fetch("/api/quote-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Quote PDF render failed (${res.status})`);
  return res.blob();
}
