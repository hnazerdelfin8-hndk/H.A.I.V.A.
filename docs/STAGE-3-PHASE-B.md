# H.A.I.V.A. Stage 3 Phase B — Tool ↔ Integration Bridge

Stage 3B connects the existing Tool Registry to the Stage 3 Integration Manager without replacing either component.

## Flow

`TOOL REGISTRY → TOOL-INTEGRATION BRIDGE → INTEGRATION MANAGER → INTEGRATION → RESULT`

Execution through `Controlled Executor` preserves the existing `safe`, `controlled`, and `approval` boundaries.

## Guarantees

- Registered integrations are required before a bridge can be created.
- Tool names and integration names are normalized.
- Integration context is propagated to the integration executor.
- Existing tool safety boundaries remain authoritative.
- The bridge is additive; the existing registry and integration manager remain intact.
- Missing integrations and invalid risk levels fail explicitly.
