import assert from "node:assert/strict";
import { createIntegrationManager } from "../../core/integrations/manager.js";
import { createIntegrationTool } from "../../core/integrations/tool-bridge.js";
import { registerTool, getTool, clearTools } from "../../core/tools/registry.js";
import { executeRegisteredTool } from "../../core/agent/controlled-executor.js";

clearTools();

const calls = [];
const manager = createIntegrationManager({
  integrations: [{
    name: " Test API ",
    description: "Test integration",
    risk: "controlled",
    execute: async (input, context) => {
      calls.push({ input, context });
      return { ok: true, input, context };
    }
  }]
});

const tool = createIntegrationTool({
  toolName: " Test API Tool ",
  integrationName: " Test API ",
  register: true,
  registerTool,
  integrationManager: manager
});

assert.equal(tool.name, "test api tool");
assert.equal(tool.risk, "controlled");
assert.equal(getTool("TEST API TOOL").name, "test api tool");

await assert.rejects(() => executeRegisteredTool("test api tool", { value: 1 }), /Approval required for tool: test api tool/);

const result = await executeRegisteredTool("test api tool", { value: 2 }, {
  approved: true,
  context: { requestId: "req-1" }
});

assert.equal(result.ok, true);
assert.deepEqual(result.input, { value: 2 });
assert.equal(result.context.integration, "test api");
assert.equal(result.context.tool, "test api tool");
assert.equal(result.context.risk, "controlled");
assert.equal(result.context.requestId, "req-1");
assert.equal(calls.length, 1);

assert.throws(
  () => createIntegrationTool({ toolName: "downgrade", integrationName: "test api", risk: "safe", integrationManager: manager }),
  /Tool risk cannot be lower than integration risk/
);

const safeManager = createIntegrationManager({
  integrations: [{ name: "safe-service", risk: "safe", execute: async (input) => ({ ok: true, input }) }]
});
const safeTool = createIntegrationTool({
  toolName: "safe-service-tool",
  integrationName: "safe-service",
  integrationManager: safeManager
});
assert.equal(safeTool.risk, "safe");
assert.deepEqual(await safeTool.execute({ value: 3 }), { ok: true, input: { value: 3 } });

assert.throws(
  () => createIntegrationTool({ toolName: "broken", integrationName: "missing", integrationManager: manager }),
  /Integration not found: missing/
);

clearTools();
console.log("PASS: HAIVA Stage 3B Tool Integration Bridge tests");
