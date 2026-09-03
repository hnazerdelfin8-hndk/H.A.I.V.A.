# H.A.I.V.A. Tool Contract

Phase 3 introduces a dedicated tool registry alongside the existing skill system. Existing skills and `api/tools.js` remain unchanged during migration.

## Tool descriptor

A registered tool has:

- `name` — unique, case-insensitive identifier.
- `description` — human-readable purpose.
- `risk` — one of `safe`, `controlled`, or `approval`.
- `input` — optional input metadata/schema.
- `execute(input, context)` — function that performs the tool action.

## Registry API

- `registerTool(tool)` — validates and registers a tool; duplicate names are rejected.
- `getTool(name)` — returns the internal descriptor or `null`.
- `hasTool(name)` — checks registration.
- `listTools()` — returns tool metadata without executable functions.
- `executeTool(name, input, context)` — executes a registered tool.
- `unregisterTool(name)` — removes a tool.
- `clearTools()` — clears the registry; intended for tests/reset scenarios.

Names are normalized to lowercase and trimmed.

## Safety

The registry records risk metadata but does not bypass approval controls. The agent/execution layer remains responsible for enforcing whether an action may run autonomously or requires approval.

## Migration rule

Do not remove or rewrite the existing skill manager or tools API as part of Phase 3. New tools should be registered here first when they need the agentic tool contract. Existing functionality will be adapted incrementally after the registry is verified.
