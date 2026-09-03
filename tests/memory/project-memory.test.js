import assert from "node:assert/strict";
import { createMemoryStore } from "../../core/memory/project-memory.js";

const memory = createMemoryStore();
const project = memory.remember("project", "H.A.I.V.A. uses an agentic core.");
const task = memory.remember("task", "Phase 7 builds project and decision memory.", { phase: 7 });
const decision = memory.remember("decision", "Keep main protected until migration is verified.");

assert.equal(project.type, "project");
assert.equal(task.metadata.phase, 7);
assert.equal(memory.recall({ query: "agentic core" })[0].id, project.id);
assert.equal(memory.recall({ type: "decision" })[0].id, decision.id);
assert.equal(memory.forget(task.id), true);
assert.equal(memory.forget(task.id), false);
assert.equal(memory.snapshot().length, 2);

assert.throws(() => memory.remember("invalid", "should fail"), /Invalid memory type/);
assert.throws(() => memory.remember("project", ""), /Memory content is required/);

console.log("PASS: HAIVA Phase 7 Project Memory tests");
