import assert from "node:assert/strict";
import { createTask, setTaskState } from "../../core/agent/task-manager.js";
import { classifyAction, requiresApproval } from "../../core/agent/approval.js";
import { runAgent } from "../../core/agent/orchestrator.js";

const task = createTask("test task", ["first step"]);
assert.equal(task.state, "created");
assert.equal(task.steps.length, 1);
setTaskState(task, "planned");
assert.equal(task.state, "planned");

assert.equal(classifyAction({ type: "inspect" }), "safe");
assert.equal(classifyAction({ type: "write" }), "controlled");
assert.equal(classifyAction({ type: "production_deploy" }), "approval");
assert.equal(requiresApproval({ type: "production_deploy" }), true);

const executed = [];
const result = await runAgent("build a test plan", {
  planner: async goal => [
    { id: "inspect", description: "Inspect", action: { type: "inspect", goal } },
    { id: "write", description: "Write", action: { type: "write", goal } }
  ],
  executor: async action => {
    executed.push(action.type);
    return `${action.type}-done`;
  },
  verifier: async taskState => ({ passed: taskState.steps.every(step => step.status === "completed"), result: "verified" })
});

assert.equal(result.state, "completed");
assert.deepEqual(executed, ["inspect", "write"]);
assert.equal(result.result, "verified");

const blocked = await runAgent("deploy", {
  planner: async () => [{ id: "deploy", description: "Deploy", action: { type: "production_deploy" } }],
  executor: async () => { throw new Error("must not execute"); }
});
assert.equal(blocked.state, "blocked");

const failed = await runAgent("fail", {
  planner: async () => [{ id: "step", description: "Fail", action: { type: "inspect" } }],
  executor: async () => { throw new Error("expected failure"); }
});
assert.equal(failed.state, "failed");
assert.equal(failed.error, "expected failure");

console.log("HAIVA Phase 2 agent tests: PASS");
