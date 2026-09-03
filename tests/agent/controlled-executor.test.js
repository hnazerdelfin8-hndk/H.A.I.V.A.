// =========================================
// H.A.I.V.A. PHASE 5 — CONTROLLED EXECUTOR TESTS
// =========================================

import assert from "node:assert/strict";
import { clearTools, registerTool } from "../../core/tools/registry.js";
import { createControlledExecutor, executeRegisteredTool } from "../../core/agent/controlled-executor.js";

clearTools();

registerTool({
  name: "safe-test",
  description: "Safe test tool",
  risk: "safe",
  execute: async (input, context) => ({ input, tool: context.tool, actionType: context.action.type })
});

registerTool({
  name: "controlled-test",
  description: "Controlled test tool",
  risk: "controlled",
  execute: async (input, context) => ({ input, tool: context.tool, actionType: context.action.type })
});

registerTool({
  name: "approval-test",
  description: "Approval-required test tool",
  risk: "approval",
  execute: async () => "should-not-run"
});

const safeResult = await executeRegisteredTool("SAFE-TEST", { ok: true });
assert.deepEqual(safeResult, {
  input: { ok: true },
  tool: "safe-test",
  actionType: "safe"
});

const controlledResult = await executeRegisteredTool("controlled-test", "payload", { approved: true });
assert.equal(controlledResult.tool, "controlled-test");
assert.equal(controlledResult.actionType, "controlled");

await assert.rejects(
  () => executeRegisteredTool("controlled-test", null),
  /Approval required for tool: controlled-test/
);

await assert.rejects(
  () => executeRegisteredTool("approval-test", null, { approved: false }),
  /Approval required for tool: approval-test/
);

const executor = createControlledExecutor({ approved: true, context: { source: "phase5-test" } });
const executorResult = await executor({ tool: "safe-test", input: 42 }, { taskId: "task-1" });
assert.equal(executorResult.input, 42);
assert.equal(executorResult.tool, "safe-test");
assert.equal(executorResult.actionType, "safe");

await assert.rejects(
  () => executor({ tool: "missing-tool", input: null }),
  /not registered/
);

clearTools();
console.log("PASS: HAIVA Phase 5 Controlled Execution tests");
