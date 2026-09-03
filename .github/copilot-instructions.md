# H.A.I.V.A. Engineering Constitution

## Mission
H.A.I.V.A. is being evolved from a voice assistant into an agentic AI automation core that can understand goals, plan work, use tools, execute tasks, verify results, diagnose failures, and safely improve systems.

## Non-Negotiable Rules

1. **Inspect before editing.** Understand the repository, relevant files, dependencies, configuration, and current behavior before changing code.
2. **Plan before implementation.** For non-trivial work, identify the goal, affected components, risks, verification method, and rollback path before editing.
3. **Preserve working behavior.** Do not rewrite or restructure functioning code unless the migration has a clear purpose and the replacement is verified.
4. **Make the smallest safe change.** Prefer focused, reversible changes over broad rewrites.
5. **Verify every meaningful change.** Run the strongest available tests, checks, build, lint, or runtime verification after implementation.
6. **Never claim success without evidence.** A change is not complete merely because code was written; the resulting behavior must be verified.
7. **Diagnose failures systematically.** When verification fails: capture the actual error, identify the root cause, make the smallest fix, and verify again.
8. **Protect secrets.** Never place API keys, tokens, passwords, private credentials, or sensitive values in source code, prompts, logs, commits, or client-side code.
9. **Respect approval boundaries.** Reading, analysis, planning, testing, and branch creation may be autonomous. Destructive actions, production changes, credential changes, and irreversible operations require explicit human approval.
10. **Keep changes traceable.** Use clear commits and document important architectural decisions.
11. **Preserve compatibility during migration.** Existing APIs and interfaces remain stable unless a migration explicitly changes them.
12. **Prefer reuse over duplication.** Extend existing capabilities when appropriate instead of creating competing implementations.

## Agent Execution Loop

For implementation tasks, prefer this sequence:

`UNDERSTAND → INSPECT → PLAN → EXECUTE → TEST → DIAGNOSE/FIX → VERIFY → REPORT`

If verification fails, do not stop at the error message. Continue through diagnosis and correction when the required tools and permissions allow it.

## Architecture Direction

The target architecture is centered on:

- **Brain:** understanding, intent, reasoning, planning, decisions.
- **Agent:** task orchestration, execution, approvals, and state.
- **Tools:** GitHub, filesystem, terminal, research, APIs, and deployment capabilities.
- **Project Intelligence:** repository scanning, architecture analysis, dependency awareness, and project context.
- **Verification:** tests, runtime checks, diagnostics, and evidence-based completion.
- **Memory:** conversation, project, task, and architectural decision memory.
- **Voice/UI:** interfaces to the core, not the core itself.

## Migration Rule

The current H.A.I.V.A. implementation is a working baseline. Build the new core incrementally alongside it. Do not move or delete existing modules until their replacement has been implemented and verified.

## Communication Rule

When reporting work, distinguish clearly between:

- what was inspected,
- what was changed,
- what was tested,
- what passed or failed,
- and what still requires human action.
