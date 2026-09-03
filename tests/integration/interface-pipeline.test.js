// =========================================
// H.A.I.V.A. PHASE 9 — INTERFACE PIPELINE TESTS
// =========================================

import assert from "node:assert/strict";
import { createInterfacePipeline } from "../../core/integration/interface-pipeline.js";
import { createMemoryStore } from "../../core/memory/project-memory.js";

const memory = createMemoryStore();
const pipeline = createInterfacePipeline({
  memory,
  request: async input => ({ success: true, response: `Processed: ${input}` })
});

const success = await pipeline.run("Hello HAIVA");
assert.equal(success.ok, true);
assert.equal(success.task.state, "completed");
assert.equal(success.task.result.response, "Processed: Hello HAIVA");
assert.equal(success.verification.passed, true);
assert.equal(memory.recall({ type: "task", query: "hello haiva" }).length, 1);
assert.equal(memory.recall({ type: "decision", query: "verification passed" }).length, 1);

const failureMemory = createMemoryStore();
const failurePipeline = createInterfacePipeline({
  memory: failureMemory,
  request: async () => ({ success: false, response: "Connection fallback" })
});

const failure = await failurePipeline.run("Fail this request");
assert.equal(failure.ok, false);
assert.equal(failure.task.state, "failed");
assert.equal(failure.verification.passed, false);
assert.equal(failure.diagnosis.category, "interface_execution");
assert.equal(failureMemory.recall({ type: "decision", query: "verification failed" }).length, 1);

await assert.rejects(
  () => pipeline.run(""),
  /Task goal is required/
);

assert.throws(
  () => createInterfacePipeline({ request: null }),
  /Interface request handler is required/
);

console.log("PASS: HAIVA Phase 9 Interface Pipeline tests");
