# H.A.I.V.A. Stage 2 Phase B — Autonomous Task Engine

## Purpose

Stage 2 Phase B adds a bounded autonomous task execution loop on top of the existing Phase 1–10 core and Stage 2 Phase A capability.

## Execution model

`GOAL → PLAN → DEPENDENCY CHECK → EXECUTE → VERIFY → DIAGNOSE → BOUNDED RETRY → NEXT STEP → FINAL VERIFY → REPORT`

## Guarantees

- Planner output is validated before execution.
- Task graphs support explicit `dependsOn` relationships.
- Missing dependencies and duplicate step IDs fail safely.
- Approval-required actions remain blocked without explicit approval.
- Each step has a bounded retry count.
- Diagnostics decide whether a failure is retryable.
- Each successful step is verified before dependent steps proceed.
- Final task verification is required before completion.
- Maximum step count is bounded to prevent runaway plans.
- Existing Phase 1–10 and Stage 2 Phase A modules are preserved and remain in the canonical verification chain.

## Step contract

Each planner step may contain:

- `id` — unique step identifier.
- `description` — human-readable description.
- `action` — action passed to the executor.
- `dependsOn` — optional list of prerequisite step IDs.

## Safety boundary

The engine does not remove or bypass the existing approval model. Production deployment, deletion, database migration, credential changes, and other approval-level actions remain blocked unless explicitly approved.

## Verification

The canonical gate runs `npm run test:stage2b`, which first runs the complete Stage 2 Phase A chain and therefore preserves the Phase 10 gate and all earlier phases before Phase B tests execute.
