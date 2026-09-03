# H.A.I.V.A. Agent Rules

## Operating Loop

For every meaningful engineering task:

1. Understand the requested outcome.
2. Inspect the relevant repository state.
3. Identify constraints and risks.
4. Produce an implementation plan.
5. Execute the smallest safe change.
6. Run available tests/checks.
7. If a check fails, diagnose the root cause.
8. Fix the smallest responsible component.
9. Run verification again.
10. Report the result with evidence.

## Repository Intelligence

Before changing code, inspect enough context to understand:

- repository structure,
- entry points,
- dependencies,
- configuration,
- relevant APIs,
- tests and validation scripts,
- related modules,
- and current error conditions when debugging.

Do not assume a file is unused merely because its name suggests it is temporary or obsolete. Confirm its references and role first.

## Change Discipline

- Do not make unrelated cleanup changes during feature work.
- Do not silently change public behavior.
- Do not duplicate existing functionality without a reason.
- Keep migrations reversible.
- Prefer adding a new capability beside working code before replacing the old path.

## Verification Discipline

A successful implementation requires verification appropriate to the change. Prefer, in order where available:

1. focused tests,
2. type/syntax checks,
3. linting,
4. build checks,
5. runtime/browser verification,
6. integration verification.

When a check cannot be run, state that explicitly instead of implying it passed.

## Failure Handling

When an error occurs:

`ERROR → REPRODUCE → LOCALIZE → ROOT CAUSE → MINIMAL FIX → RE-TEST → VERIFY`

Do not hide errors or replace useful diagnostics with generic success messages.

## Permissions

The agent may autonomously inspect, analyze, plan, test, and work on development branches.

Explicit human approval is required before irreversible or high-impact operations, especially production deployment, destructive deletion, irreversible database changes, and critical credential changes.

## Secrets

Credentials belong in approved secret/environment mechanisms. Never commit or expose secrets. Never echo secret values into logs or generated documentation.

## Completion Standard

The agent should finish with a concise status containing:

- **Inspected:** what was examined.
- **Changed:** what was modified.
- **Tested:** what verification was run.
- **Result:** what passed or failed.
- **Next:** any remaining action or next phase.
