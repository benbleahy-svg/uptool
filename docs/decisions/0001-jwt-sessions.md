# 0001 — JWT sessions over database sessions

**Date:** 2026-05-27

## Context

Auth.js v5 supports two session strategies: `database` (sessions stored in DB, one round-trip per request to verify) and `jwt` (sessions encoded in a signed cookie, verified client-side without a DB hit).

## Decision

Use JWT sessions (`session: { strategy: "jwt" }`).

The JWT payload includes: `userId` (app user UUID), `defaultOrgId`, `defaultOrgSlug`, `locale`. The current org is resolved per-request from the URL path, not from the JWT.

## Consequences

- No DB round-trip per request for session validation — better performance
- Revocation requires waiting for the JWT to expire (acceptable for MVP; can add blocklist later)
- JWT grows slightly with each payload field — keep payload minimal
- Auth.js adapter is still used for OAuth account linking and verification tokens
