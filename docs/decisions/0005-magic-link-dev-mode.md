# 0005 — Console-log magic links in development

**Date:** 2026-05-27

## Context

Auth.js Resend provider sends email magic links via the Resend API. Local development requires a Resend account and a real email domain, adding setup friction. AC#2 (sign in with magic link) must work without external dependencies in local dev.

## Decision

In `auth.ts`, the `sendVerificationRequest` callback checks:
```ts
if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY) {
  console.log("Magic link URL:", url);
  return;
}
```

When `RESEND_API_KEY` is absent (the default in `.env.example`), magic link URLs are printed to the Next.js server console. The developer clicks the URL directly.

In production, `RESEND_API_KEY` must be set — missing it throws.

## Consequences

- Zero setup required for local magic link testing
- Magic links are visible in terminal logs — acceptable for local dev, not a concern in prod
- If a developer accidentally deploys without `RESEND_API_KEY`, magic links silently fail (logged but not sent). Consider adding a startup check in a later epic.
