// Typed errors for the estimate services. Callers (server actions) translate
// these into a { ok: false, error } result rather than letting them throw across
// the network boundary.

/** Input failed validation (Zod or a service-level invariant). */
export class ValidationError extends Error {
  /** Optional structured detail (e.g. ZodError.issues). */
  readonly issues?: unknown;
  constructor(message: string, issues?: unknown) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/** A referenced row doesn't exist for the given org (covers cross-org access:
 *  the org-scoped WHERE matches nothing, which we surface as not-found). */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}
