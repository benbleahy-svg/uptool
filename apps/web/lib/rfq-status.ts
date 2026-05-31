// Single source of truth for an RFQ's *displayed* status. The stored
// `rfqs.status` enum drives the progress states; "declined" is derived on top so
// the dashboard pill and any status display agree without duplicating logic.
//
// Declined when EITHER:
//   - the RFQ is explicitly declined (declinedAt set), or
//   - it has parts and every part is no-bid, or
//   - it's already stored as no_bid (decline always sets this too).
// A mix of completed + no-bid parts is NOT declined — it falls through to the
// stored status (e.g. "estimated").

export type StoredRfqStatus =
  | "new"
  | "estimated"
  | "quoted"
  | "sent"
  | "won"
  | "lost"
  | "no_bid";

export type DerivedRfqStatus = Exclude<StoredRfqStatus, "no_bid"> | "declined";

export interface RfqStatusInput {
  status: StoredRfqStatus;
  declinedAt: Date | string | null;
  parts: Array<{ isNoBid: boolean }>;
}

export function getRfqStatus(rfq: RfqStatusInput): DerivedRfqStatus {
  if (rfq.declinedAt) return "declined";
  if (rfq.parts.length > 0 && rfq.parts.every((p) => p.isNoBid)) return "declined";
  if (rfq.status === "no_bid") return "declined";
  return rfq.status;
}
