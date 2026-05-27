/**
 * Backfill script: re-derive customer names for existing RFQs.
 *
 * Idempotent: only processes customers where source IS NULL.
 * Run with: DATABASE_URL=... pnpm exec tsx src/backfill-customer-source.ts
 */
import { isNull, eq } from "drizzle-orm";
import { db } from "./client.js";
import { customers, emailThreads } from "./schema.js";

// Import pure functions only (no DB/API calls in the backfill — just heuristics)
// We can't import from @uptool/services here (circular), so inline the logic.

const FREE_PROVIDERS = new Set([
  "gmail.com", "gmx.de", "gmx.net", "web.de", "t-online.de",
  "outlook.com", "hotmail.com", "yahoo.com", "yahoo.de", "posteo.de", "mail.de",
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
];

function parseSignatureCompany(bodyText: string): string | null {
  const lines = bodyText.split(/\r?\n/);
  let sigStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SIGNATURE_MARKERS.some((re) => re.test((lines[i] ?? "").trim()))) {
      sigStart = i;
      break;
    }
  }
  const candidates = sigStart >= 0 ? lines.slice(sigStart) : lines.slice(-10);
  for (const line of candidates) {
    const trimmed = line.trim();
    if (trimmed && LEGAL_FORM_RE.test(trimmed)) {
      return trimmed.replace(/^[\s\-|•*>]+/, "").trim();
    }
  }
  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function domainToName(domain: string): string {
  const parts = domain.split(".");
  let nameParts: string[];
  if (parts.length >= 3 && (parts[parts.length - 2]?.length ?? 0) <= 3) {
    nameParts = parts.slice(0, -2);
  } else if (parts.length >= 3) {
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

type CustomerSource =
  | "signature_parsed"
  | "ai_extracted"
  | "domain_derived"
  | "free_provider_fallback"
  | "manual";

function deriveName(
  domain: string,
  contactName: string | null,
  bodyText: string | null,
): { name: string; source: CustomerSource } {
  // 1. Signature heuristic
  if (bodyText) {
    const company = parseSignatureCompany(bodyText);
    if (company) return { name: company, source: "signature_parsed" };
  }

  // 2. Free provider
  if (FREE_PROVIDERS.has(domain)) {
    return { name: contactName?.trim() || "Privatkunde", source: "free_provider_fallback" };
  }

  // 3. Domain derivation
  if (domain) {
    return { name: domainToName(domain), source: "domain_derived" };
  }

  return { name: contactName || "Unbekannt", source: "domain_derived" };
}

async function main() {
  // Only process customers with NULL source (idempotent)
  const staleCustomers = await db.query.customers.findMany({
    where: isNull(customers.source),
    with: { contacts: { limit: 1 }, rfqs: { limit: 1 } },
  });

  console.log(`Found ${staleCustomers.length} customers to backfill.`);

  for (const customer of staleCustomers) {
    // Get first contact's email to derive domain
    const firstContact = customer.contacts[0];
    const contactEmail = firstContact?.email ?? "";
    const domain = contactEmail.split("@")[1]?.toLowerCase() ?? customer.domain ?? "";
    const contactName = firstContact?.name ?? null;

    // Try to find an email body for any RFQ in this customer
    let bodyText: string | null = null;
    const firstRfq = customer.rfqs[0];
    if (firstRfq) {
      // Find the first inbound email message for this RFQ
      const thread = await db.query.emailThreads.findFirst({
        where: eq(emailThreads.rfqId, firstRfq.id),
      });
      if (thread) {
        const msg = await db.query.emailMessages.findFirst({
          where: (m, { and, eq }) =>
            and(eq(m.threadId, thread.id), eq(m.direction, "inbound")),
          orderBy: (m, { asc }) => [asc(m.receivedAt)],
        });
        bodyText = msg?.bodyText ?? null;
      }
    }

    const { name, source } = deriveName(domain, contactName, bodyText);

    await db
      .update(customers)
      .set({ name, source })
      .where(eq(customers.id, customer.id));

    console.log(
      `  [${customer.id.slice(0, 8)}] "${customer.name}" → "${name}" (${source})`,
    );
  }

  console.log("Backfill complete.");
  await db.$client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
