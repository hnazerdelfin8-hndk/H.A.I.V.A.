// =========================================
// H.A.I.V.A. STAGE 4D — VOICE → FULL CORE PIPELINE TESTS
// =========================================

import assert from "node:assert/strict";
import { createInterfacePipeline } from "../../core/integration/interface-pipeline.js";
import { createMemoryStore } from "../../core/memory/project-memory.js";

const memory = createMemoryStore();
const pipeline = createInterfacePipeline({
  memory,
  request: async input => ({ success: true, response: `Core response: ${input}` })
});

const result = await pipeline.run("status");
assert.equal(result.ok, true);
assert.equal(result.task.state, "completed");
assert.equal(result.verification.passed, true);
assert.equal(result.task.result.response, "Core response: status");
assert.equal(memory.recall({ type: "task", query: "status" }).length, 1);

console.log("PASS: HAIVA Stage 4D Voice → Full H.A.I.V.A. Pipeline tests");
