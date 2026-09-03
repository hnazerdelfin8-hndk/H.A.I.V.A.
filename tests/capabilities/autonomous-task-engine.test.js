// =========================================
// H.A.I.V.A. STAGE 2 — PHASE B TESTS
// =========================================

import assert from "node:assert/strict";
import { createAutonomousTaskEngine } from "../../core/capabilities/autonomous-task-engine.js";

const executionOrder = [];
const engine = createAutonomousTaskEngine({
  planner: async () => [
    { id: "inspect", description: "Inspect", action: { type: "inspect" } },
    { id: "analyze", description: "Analyze", action: { type: "analyze" }, dependsOn: ["inspect"] },
    { id: "report", description: "Report", action: { type: "report" }, dependsOn: ["analyze"] }
  ],
  executor: async (action) => {
    executionOrder.push(action.type);
    return `${action.type}-done`;
  },
  verifier: async (value, context) => {
    if (context?.final) return { passed: true, result: "final-verified" };
    return { passed: true, result: value };
  },
  diagnostics: async () => ({ retryable: false })
});

const completed = await engine.run("produce a verified report");
assert.equal(completed.state, "completed");
assert.equal(completed.result, "final-verified");
assert.deepEqual(executionOrder, ["inspect", "analyze", "report"]);
assert.deepEqual(completed.steps.map(step => step.status), ["completed", "completed", "completed"]);

let attempts = 0;
const retryEngine = createAutonomousTaskEngine({
  planner: async () => [{ id: "retry", action: { type: "inspect" } }],
  executor: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary network failure");
    return "ok";
  },
  verifier: async (value, context) => context?.final
    ? { passed: true, result: value }
    : { passed: true, result: value },
  diagnostics: async (error) => ({ retryable: /network/i.test(error.message), error: error.message })
});

const retried = await retryEngine.run("recover from a temporary failure", { maxAttempts: 2 });
assert.equal(retried.state, "completed");
assert.equal(attempts, 2);

const blockedEngine = createAutonomousTaskEngine({
  planner: async () => [{ id: "deploy", action: { type: "production_deploy" } }],
  executor: async () => { throw new Error("must not execute"); },
  verifier: async () => ({ passed: true }),
  diagnostics: async () => ({ retryable: false })
});

const blocked = await blockedEngine.run("deploy to production");
assert.equal(blocked.state, "blocked");
assert.match(blocked.error, /Approval required/);

const invalidEngine = createAutonomousTaskEngine({
  planner: async () => [
    { id: "a", action: { type: "inspect" }, dependsOn: ["missing"] }
  ],
  executor: async () => "never",
  verifier: async () => ({ passed: true }),
  diagnostics: async () => ({ retryable: false })
});

const invalid = await invalidEngine.run("invalid dependency graph");
assert.equal(invalid.state, "failed");
assert.match(invalid.error, /Unknown task dependency/);

const bounded = await engine.run("bounded task", { maxSteps: 2 });
assert.equal(bounded.state, "failed");
assert.match(bounded.error, /maximum step limit/);

console.log("PASS: HAIVA Stage 2 Phase B Autonomous Task Engine tests");
