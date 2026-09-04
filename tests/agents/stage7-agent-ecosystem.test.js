import assert from "node:assert/strict";
import { createAgentRegistry, matchAgents, delegateTask, coordinateTasks, recordAgentOutcome, createAgentMemory, transitionAgent } from "../../core/agents/ecosystem.js";

const registry = createAgentRegistry([
  { id: "researcher", capabilities: ["research", "web"], score: .7 },
  { id: "builder", capabilities: ["code", "test"], score: .8 }
]);
assert.equal(registry.select("research").id, "researcher");
assert.equal(matchAgents(registry, ["code", "test"])[0].id, "builder");
assert.equal(delegateTask(registry, { id: "t1", capabilities: ["research"] }).agent.id, "researcher");
assert.equal(coordinateTasks(registry, [{ id: "t1", capabilities: ["research"] }, { id: "t2", capabilities: ["code"] }]).length, 2);
assert.equal(recordAgentOutcome(registry, "researcher", { success: true }).lastOutcome, "success");
const memory = createAgentMemory(); memory.remember("k", { result: "ok" }); assert.equal(memory.recall("k").result, "ok");
const paused = transitionAgent({ id: "x", status: "active" }, "paused"); assert.equal(paused.status, "paused");
assert.throws(() => transitionAgent({ id: "x", status: "retired" }, "active"));
console.log("PASS: Stage 7A-7H Advanced Agent Ecosystem verification");
