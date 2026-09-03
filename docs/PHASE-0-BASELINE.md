# H.A.I.V.A. Core vNext — Phase 0 Baseline

**Baseline date:** 2026-09-03  
**Baseline branch:** `main`  
**vNext branch:** `haiva-core-vnext`  
**Baseline commit:** `3a9de20e6b9264bbb2894af964cc7519c372130d`

## Purpose

This document freezes the known working state before the H.A.I.V.A. Core vNext migration begins. The existing application must remain untouched on `main` while new architecture is introduced incrementally on `haiva-core-vnext`.

## Current architecture snapshot

The current runtime is centered on:

`index.html → core/app.js → core/assistant.js → core/router.js → skills/API`

Supporting layers currently include:

- `core/brain/` — intent, reasoning, and decision modules
- `core/memory.js` — browser localStorage conversation memory
- `core/skill-manager.js` — registered skill execution
- `core/skills/` — current built-in skills
- `core/voice/` — speech-to-text, text-to-speech, wake-word helpers
- `api/` — chat, tools, and voice server endpoints
- `ui/` — current interface assets

## Current behavior to preserve

1. H.A.I.V.A. boots into a ready state.
2. Browser microphone permission can be requested through the Voice button.
3. Speech recognition supports the configured wake-word flow.
4. Commands are routed through the current assistant/router path.
5. Local skills can execute when matched.
6. Other requests can reach the configured AI chat endpoint.
7. Browser speech synthesis can speak responses.
8. Existing conversation memory must not be discarded during migration.

## Known architecture limitation

The current system is primarily a voice/chat response pipeline. It is **not yet** a full autonomous development/automation agent.

The vNext architecture will add planning, orchestration, tool execution, project intelligence, verification, diagnostics, controlled approvals, and durable project/task memory without replacing the working voice layer prematurely.

## Repository observations

- The repository currently has no root `package.json` in the baseline tree.
- The current application is a browser-first JavaScript application with server endpoints under `api/`.
- `index.html` loads `./core/app.js` directly as an ES module.
- Existing core files must be treated as production-sensitive until individually migrated and verified.
- Existing temporary/unused skill files are noted but are **not** being deleted in Phase 0.

## Verification status

Phase 0 verification performed:

- Repository metadata checked.
- Default branch confirmed as `main`.
- Baseline commit SHA recorded.
- New migration branch created from the exact baseline commit.
- Existing application entry point inspected.
- Existing API entry point inspected.
- Repository tree inspected.

No production code has been modified as part of Phase 0.

## Migration rule

Do not perform a whole-repository rewrite. Add the new Core vNext capabilities beside the existing system, migrate one responsibility at a time, verify each change, and remove/rework legacy code only after its replacement is proven stable.

## Next phase

**Phase 1 — H.A.I.V.A. Constitution:** add project-level agent rules, architecture documentation, and change/verification policies before implementing the new agent runtime.
