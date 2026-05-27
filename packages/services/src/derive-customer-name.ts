/**
 * Pure, DB-free functions for customer name derivation.
 * Imported by customer.ts and by unit tests.
 */
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

export type CustomerSource =
  | "signature_parsed"
  | "ai_extracted"
  | "domain_derived"
  | "free_provider_fallback"
  | "manual";

// ─── Constants ────────────────────────────────────────────────────────────────

export const FREE_PROVIDERS = new Set([
  "gmail.com",
  "gmx.de",
  "gmx.net",
  "web.de",
  "t-online.de",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "yahoo.de",
  "posteo.de",
  "mail.de",
]);

const LEGAL_FORM_RE =
  /\b(GmbH(?:\s*&\s*Co\.\s*KG)?|AG|KG|OHG|GbR|e\.K\.|UG|mbH|GesmbH|Ltd\.?|Inc\.?|LLC|S\.A\.|PLC)\b/i;

const SIGNATURE_MARKERS = [
  /^--\s*$/,
  /^Mit freundlichen Grüßen/i,
  /^Viele Grüße/i,
  /^Herzliche Grüße/i,
  /^Freundliche Grüße/i,
  /^MfG\b/i,
  /^Best regards/i,
  /^Kind regards/i,
  /^Regards,?$/i,
  /^Sincerely/i,
];

const AI_MODEL = "claude-haiku-4-5-20251001";
const PROMPT_VERSION = "customer-extract-v1";
const HAIKU_INPUT_COST = 0.80 / 1_000_000;
const HAIKU_OUTPUT_COST = 4.00 / 1_000_000;

// ─── Heuristic signature parser ───────────────────────────────────────────────

export function parseSignatureCompany(bodyText: string): string | null {
  const lines = bodyText.split(/\r?\n/);

  let sigStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (SIGNATURE_MARKERS.some((re) => re.test(line.trim()))) {
      sigStart = i;
      break;
    }
  }

  const candidates = sigStart >= 0 ? lines.slice(sigStart) : lines.slice(-10);

  for (const line of candidates) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (LEGAL_FORM_RE.test(trimmed)) {
      return trimmed.replace(/^[\s\-|•*>]+/, "").trim();
    }
  }

  return null;
}

// ─── Domain utilities ─────────────────────────────────────────────────────────

export function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function domainToName(domain: string): string {
  const parts = domain.split(".");
  let nameParts: string[];
  if (parts.length >= 3 && (parts[parts.length - 2]?.length ?? 0) <= 3) {
    // compound TLD like .co.uk — strip last two parts
    nameParts = parts.slice(0, -2);
  } else if (parts.length >= 3) {
    // 3+ parts with standard TLD — first part is a subdomain
    nameParts = parts.slice(1, -1);
  } else {
    nameParts = parts.slice(0, -1);
  }

  return nameParts
    .join(".")
    .split(/[.\-]/)
    .filter(Boolean)
    .map(capitalize)
    .join(" ");
}

// ─── AI extraction ────────────────────────────────────────────────────────────

export interface AiRunData {
  model: string;
  promptVersion: string;
  inputHash: string;
  outputJsonb: unknown;
  latencyMs: number;
  costUsd: string;
}

async function extractWithAI(
  bodyText: string,
): Promise<{ name: string | null; runData: AiRunData }> {
  const truncated = bodyText.slice(0, 4000);
  const inputHash = createHash("sha256").update(truncated).digest("hex");

  const prompt = `Extract the sender's company name from this email signature. Return JSON only: {"company_name": "..." | null}. If no clear company is mentioned, return null.\n\nEmail body:\n${truncated}`;

  const start = Date.now();
  const client = new Anthropic();

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 64,
    messages: [{ role: "user", content: prompt }],
  });

  const latencyMs = Date.now() - start;
  const rawText = message.content[0]?.type === "text" ? message.content[0].text : "";

  let parsed: { company_name: string | null } = { company_name: null };
  try {
    parsed = JSON.parse(rawText.trim());
  } catch {
    // malformed JSON
  }

  const inputTokens = message.usage.input_tokens;
  const outputTokens = message.usage.output_tokens;
  const costUsd = (inputTokens * HAIKU_INPUT_COST + outputTokens * HAIKU_OUTPUT_COST).toFixed(6);

  return {
    name: parsed.company_name ?? null,
    runData: { model: AI_MODEL, promptVersion: PROMPT_VERSION, inputHash, outputJsonb: parsed, latencyMs, costUsd },
  };
}

// ─── Main derivation ──────────────────────────────────────────────────────────

export interface DerivationResult {
  name: string;
  source: CustomerSource;
  confidence: string | null;
  aiRunData?: AiRunData;
}

export async function deriveCustomerName(opts: {
  fromEmail: string;
  fromName?: string;
  bodyText?: string;
}): Promise<DerivationResult> {
  const domain = emailDomain(opts.fromEmail);
  const isFree = FREE_PROVIDERS.has(domain);

  // 1. Signature heuristic
  if (opts.bodyText) {
    const company = parseSignatureCompany(opts.bodyText);
    if (company) {
      return { name: company, source: "signature_parsed", confidence: "0.90" };
    }
  }

  // 2. AI extraction (skip for free providers; skip if no API key)
  if (opts.bodyText && !isFree && process.env.ANTHROPIC_API_KEY) {
    try {
      const { name, runData } = await extractWithAI(opts.bodyText);
      if (name) {
        return { name, source: "ai_extracted", confidence: "0.75", aiRunData: runData };
      }
    } catch {
      // fall through
    }
  }

  // 3. Free provider — display name or Privatkunde
  if (isFree) {
    const name = opts.fromName?.trim() || "Privatkunde";
    return { name, source: "free_provider_fallback", confidence: null };
  }

  // 4. Domain-based fallback
  if (domain) {
    return { name: domainToName(domain), source: "domain_derived", confidence: null };
  }

  const name = opts.fromName?.trim() || opts.fromEmail;
  return { name, source: "domain_derived", confidence: null };
}
