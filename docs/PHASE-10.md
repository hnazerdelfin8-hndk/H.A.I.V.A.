# H.A.I.V.A. Phase 10 — Hardening, Validation & Production Readiness

Phase 10 hardens the migration baseline without changing the verified core behavior from Phases 1–9.

## Gate requirements

- One canonical GitHub Actions verification workflow.
- Canonical workflow targets `haiva-core-vnext` for push and pull-request verification.
- Workflow token permissions remain read-only for repository contents.
- GitHub Actions use the maintained checkout/setup-node actions and Node 24.
- No Vercel deployment path is part of H.A.I.V.A. verification.
- Package remains private.
- Core orchestration, controlled execution, verification/diagnostics, memory, and integration modules must remain present.
- The Phase 10 test must run the complete Phase 1–9 verification chain before its hardening checks.

## Production boundary

Production deployment, destructive operations, database migrations, and credential changes remain approval-gated. Phase 10 validates readiness; it does not authorize or perform a production deployment.
