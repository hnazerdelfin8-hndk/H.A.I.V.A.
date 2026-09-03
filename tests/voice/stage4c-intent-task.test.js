// =========================================
// H.A.I.V.A. STAGE 4C — INTENT → AGENT TASK TESTS
// =========================================

import assert from "node:assert/strict";
import { createInterfacePipeline } from "../../core/integration/interface-pipeline.js";
import { createMemoryStore } from "../../core/memory/project-memory.js";

const memory = createMemoryStore();
const pipeline = createInterfacePipeline({
  memory,
  request: async input => ({ success: true, response: `Handled: ${input}` })
});

const result = await pipeline.run("check system status");
assert.equal(result.ok, true);
assert.equal(result.task.state, "completed");
assert.equal(result.task.goal, "check system status");
assert.equal(result.task.result.response, "Handled: check system status");
assert.equal(result.verification.passed, true);

console.log("PASS: HAIVA Stage 4C Intent → Agent Task tests");
