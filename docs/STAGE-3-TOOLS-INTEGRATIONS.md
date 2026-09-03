# H.A.I.V.A. Stage 3 — Tools & Integrations

## Purpose

Stage 3 establishes a bounded integration layer on top of the verified Stage 2 core. It provides a consistent lifecycle for registering external or local integrations, checking health, and executing integration operations without replacing the existing Tool Registry or Controlled Executor.

## Execution model

`AGENT → TOOL/INTEGRATION SELECTION → INTEGRATION MANAGER → SAFETY BOUNDARY → EXECUTE → VERIFY`

## Stage 3 first capability

The Integration Manager provides:

- normalized integration names
- duplicate registration protection
- explicit risk metadata
- integration discovery through `list()` and `get()`
- optional health checks
- execution context containing integration identity and risk
- safe failure for missing or invalid integrations

## Safety boundary

The manager does not bypass H.A.I.V.A.'s existing approval model. Controlled and approval-level operations must continue through the established controlled-execution boundary before they are allowed to affect external systems.

## Preservation rule

Stage 3 is additive. Existing Phase 1–10 and Stage 2A–2C components remain intact and are preserved in the canonical verification chain.

## Verification

The canonical gate runs `npm run test:stage3`, which first runs the complete Stage 2 Phase C chain and then the Stage 3 integration tests.
