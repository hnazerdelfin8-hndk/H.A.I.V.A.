import assert from "node:assert/strict";
import { createReasoningState, decomposeGoal, assembleContext, evaluateConstraints } from "../../core/intelligence/reasoning.js";
import { createPlan, nextReadyStep, updatePlanStep, isPlanComplete } from "../../core/intelligence/planner.js";
import { chooseAction, isActionAllowed } from "../../core/intelligence/decision.js";
import { runAutonomy } from "../../core/intelligence/autonomy.js";
import { createGoalState, transitionGoalState, isGoalTerminal } from "../../core/intelligence/state.js";
import { createAdvancedMemoryStore } from "../../core/memory/advanced-memory.js";
import { createIntelligenceMemoryBridge } from "../../core/intelligence/memory-bridge.js";

const state = createReasoningState("ship feature", { project: "HAIVA" }, [candidate => candidate.safe]);
assert.equal(decomposeGoal(state, () => ["inspect", "implement"]).length, 2);
const memory = createAdvancedMemoryStore([{ type: "fact", content: "HAIVA project", importance: 1 }]);
assert.equal(assembleContext(state, memory).memories.length, 1);
assert.equal(evaluateConstraints({ safe: true }, state.constraints).allowed, true);

const plan = createPlan("ship", [{ id: "a", description: "inspect" }, { id: "b", description: "implement", dependencies: ["a"] }]);
assert.equal(nextReadyStep(plan).id, "a");
updatePlanStep(plan, "a", { status: "completed" });
assert.equal(nextReadyStep(plan).id, "b");
updatePlanStep(plan, "b", { status: "completed" });
assert.equal(isPlanComplete(plan), true);

const choice = chooseAction([{ id: "low", score: .2 }, { id: "high", score: .9 }]);
assert.equal(choice.action.id, "high");
assert.equal(isActionAllowed(choice.action, [action => action.id === "high"]), true);

let executions = 0;
const result = await runAutonomy({
  observe: async () => ({ ok: true }),
  understand: async value => value,
  plan: async () => ({ id: ++executions }),
  decide: async planValue => planValue,
  execute: async () => ({ ok: executions > 1 }),
  verify: async value => value,
  maxRetries: 1
});
assert.equal(result.status, "completed");
assert.equal(result.attempts, 2);

const goal = createGoalState("test goal");
transitionGoalState(goal, "planning");
transitionGoalState(goal, "completed", { progress: 1 });
assert.equal(isGoalTerminal(goal), true);

const bridge = createIntelligenceMemoryBridge(memory);
bridge.rememberDecision("ship", "high confidence");
assert.ok(bridge.retrieve("high confidence").length);

console.log("PASS: Stage 6A-6H Autonomous Intelligence verification");
