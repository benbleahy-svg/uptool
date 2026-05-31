"use client";

// Session-scoped client store for the assembled quote, written by the Quote
// page's "Preview Quote" button and read by the Send page. This carries the
// tiered variant rows (their lead times + prices) and notes across navigation.
// No DB persistence yet — Epic 2's quoteService is the seam to swap in later.

import * as React from "react";

/** One priced line on the quote (a quantity break or an applied variant). */
export interface QuoteDocRow {
  quantity: number;
  leadTime: string;
  unitPrice: number;
  totalPrice: number;
}

/** A part and its rows, as shown grouped in the items table. */
export interface QuoteDocItem {
  partId: string;
  partNumber: string;
  revision: string;
  description: string;
  /** Italic per-part note shown under the description. */
  note: string;
  rows: QuoteDocRow[];
}

export interface QuoteSnapshot {
  quoteNumber: number;
  /** Free-text notes for the customer (the "Add Notes to Quote" panel). */
  quoteNote: string;
  items: QuoteDocItem[];
}

const EVENT = "quote:snapshot-change";
const key = (rfqId: string) => `quote:snapshot:${rfqId}`;

export function getQuoteSnapshot(rfqId: string): QuoteSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(rfqId));
    return raw ? (JSON.parse(raw) as QuoteSnapshot) : null;
  } catch {
    return null;
  }
}

export function saveQuoteSnapshot(rfqId: string, snapshot: QuoteSnapshot): void {
  sessionStorage.setItem(key(rfqId), JSON.stringify(snapshot));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Reactive read of the snapshot; updates on same-tab and cross-tab changes. */
export function useQuoteSnapshot(rfqId: string): QuoteSnapshot | null {
  const [snap, setSnap] = React.useState<QuoteSnapshot | null>(null);
  React.useEffect(() => {
    const sync = () => setSnap(getQuoteSnapshot(rfqId));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [rfqId]);
  return snap;
}

// Send-stage completion: the quote was sent. Stored as an ISO timestamp so the
// sidebar can mark the Send step complete across navigations (same session).
const SENT_EVENT = "quote:sent-change";
const sentKey = (rfqId: string) => `quote:sent:${rfqId}`;

export function getQuoteSentAt(rfqId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(sentKey(rfqId));
}

export function markQuoteSent(rfqId: string, sentAtISO: string): void {
  sessionStorage.setItem(sentKey(rfqId), sentAtISO);
  window.dispatchEvent(new CustomEvent(SENT_EVENT));
}

/** Reactive read of the send-stage timestamp (null = not sent). */
export function useQuoteSentAt(rfqId: string): string | null {
  const [sentAt, setSentAt] = React.useState<string | null>(null);
  React.useEffect(() => {
    const sync = () => setSentAt(getQuoteSentAt(rfqId));
    sync();
    window.addEventListener(SENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [rfqId]);
  return sentAt;
}
