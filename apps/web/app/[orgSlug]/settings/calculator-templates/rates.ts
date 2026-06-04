// Single source of truth for hourly-rate defaults used by the estimate operation
// calculator. This is the calculator-templates ("Kalkulationsvorlagen") settings
// home for rates: the operation cost engine and the rate dropdowns READ from here
// rather than hardcoding a rate inline.
//
// STUB: rates are fixed at €80,00/h until real per-shop / per-machine rates are
// configured on this settings page. Because everything reads from this module,
// wiring real rates in later is a one-file change. No framework deps — pure data.

export interface HourlyRate {
  id: string;
  /** Shown in the rate dropdown (e.g. "Default"). */
  label: string;
  /** Rate in EUR per hour. */
  eurPerHour: number;
}

export const DEFAULT_RATE_ID = "default";

const DEFAULT_RATE: HourlyRate = { id: DEFAULT_RATE_ID, label: "Default", eurPerHour: 80 };

/** Configured hourly rates. Stub: a single "Default" entry at €80/h. */
export const HOURLY_RATES: HourlyRate[] = [DEFAULT_RATE];

/** Resolve a rate id to its rate, falling back to the first configured rate. */
export function getHourlyRate(id: string): HourlyRate {
  return HOURLY_RATES.find((r) => r.id === id) ?? DEFAULT_RATE;
}
