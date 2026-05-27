# 0003 — Biome over ESLint + Prettier

**Date:** 2026-05-27

## Context

The brief pins Biome as the linter/formatter and explicitly forbids ESLint and Prettier. This ADR documents the rationale.

## Decision

Use Biome for both linting and formatting. Single `biome.json` at the repo root; one tool replaces two.

## Consequences

- Single config file, single tool invocation (`biome lint .` / `biome format . --write`)
- Biome is significantly faster than ESLint + Prettier on large codebases
- Some ESLint plugins have no Biome equivalent — acceptable for this project
- Biome formatting is opinionated; it deviates from Prettier in some cases (trailing commas, brace style). Team must accept Biome's output as the canonical style
