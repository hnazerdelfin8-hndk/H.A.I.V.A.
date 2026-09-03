// =========================================
// H.A.I.V.A. PHASE 8 — CORE INTEGRATION TESTS
// =========================================

import assert from "node:assert/strict";
import { createCorePipeline } from "../../core/integration/core-pipeline.js";
import { createMemoryStore } from "../../core/memory/project-memory.js";

function makeDependencies(overrides = {}) {
  return {
    agent: {},
    executor: {
      async execute(task) {
        task.steps = task.steps.map(step => ({ ...step, status: "completed" }));
        return { executed: true, goal: task.goal };
      },
      ...overrides.executor
    },
    verifier: {
      async verify(task, execution) {
        return { passed: true, evidence: { execution }, result: execution };
      },
      ...overrides.verifier
    },
    diagnostics: {
      async diagnose(task, verification) {
        return { category: "verification", taskId: task.id, verification };
      },
      ...overrides.diagnostics
    },
    memory: overrides.memory || createMemoryStore()
  };
}

const memory = createMemoryStore();
const pipeline = createCorePipeline(makeDependencies({ memory }));
const success = await pipeline.run("Build the Phase 8 core", {
  steps: [{ id: "integrate", description: "Integrate core layers" }]
});

assert.equal(success.ok, true);
assert.equal(success.task.state, "completed");
assert.equal(success.verification.passed, true);
assert.equal(success.task.steps[0].status, "completed");
assert.equal(memory.recall({ type: "task", query: "phase 8 core" }).length, 1);
assert.equal(memory.recall({ type: "decision", query: "verification passed" }).length, 1);

const failureMemory = createMemoryStore();
const failurePipeline = createCorePipeline(makeDependencies({
  memory: failureMemory,
  verifier: {
    async verify() {
      return { passed: false, evidence: { reason: "verification mismatch" } };
    }
  }
}));

const failure = await failurePipeline.run("Verify a failing Phase 8 task");
assert.equal(failure.ok, false);
assert.equal(failure.task.state, "failed");
assert.equal(failure.verification.passed, false);
assert.equal(failure.diagnosis.category, "verification");
assert.equal(failureMemory.recall({ type: "decision", query: "verification failed" }).length, 1);

await assert.rejects(
  () => createCorePipeline({}),
  /Agent is required/
);

await assert.rejects(
  () => pipeline.run(""),
  /Task goal is required/
);

console.log("PASS: HAIVA Phase 8 Core Integration tests");
