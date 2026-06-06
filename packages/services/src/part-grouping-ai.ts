// Claude-based CAD/PDF file pairing for multi-CAD RFQs. Stem-matching fails when a
// model and its drawing carry different document numbers (e.g. d1227434_part.step +
// d1227435_drawing.pdf); Claude reasons about token overlap, sequential numbering,
// and shared descriptive terms instead. Pure-logic grouping lives in @uptool/shared;
// this module only does the API call and hands the parsed result back.

import Anthropic from "@anthropic-ai/sdk";
import { type PairingResult, parsePairingResponse } from "@uptool/shared";

const PAIRING_MODEL = "claude-sonnet-4-6";
const PAIRING_TIMEOUT_MS = 10_000;

function buildPrompt(filenames: string[]): string {
  return `Group these manufacturing files into parts. Each part has exactly one CAD file (.step/.stp/.dxf/.iges etc.) and optionally one or more PDF drawings. Files for the same part often share descriptive tokens, have sequential document numbers (differ by 1-3), or reference the same component.

Files: ${JSON.stringify(filenames)}

Return ONLY valid JSON, no other text:
{
  "parts": [
    { "cad": "filename.step", "pdfs": ["drawing.pdf"] }
  ],
  "unmatched_pdfs": ["any_pdf_not_confidently_paired.pdf"]
}

If you cannot confidently pair a PDF, put it in unmatched_pdfs. Never guess.`;
}

/**
 * Ask Claude to pair CAD files with their drawing PDFs. Throws if no API key is
 * configured, the call times out / errors, or the response isn't parseable — the
 * caller treats any throw as "fall back to one part per CAD".
 */
export async function pairAttachmentsWithClaude(filenames: string[]): Promise<PairingResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic();
  const message = await client.messages.create(
    {
      model: PAIRING_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(filenames) }],
    },
    { timeout: PAIRING_TIMEOUT_MS, maxRetries: 0 },
  );

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  return parsePairingResponse(text);
}
