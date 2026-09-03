import assert from "node:assert/strict";
import { createMultiAgentEcosystem } from "../../core/capabilities/multi-agent-ecosystem.js";

const calls = [];
const ecosystem = createMultiAgentEcosystem({
  agents: [
    { name: "Researcher", role: "researcher", run: async objective => { calls.push(`research:${objective}`); return "research-result"; } },
    { name: "Analyst", role: "analyst", run: async (objective, context) => { calls.push(`analysis:${objective}`); assert.equal(context.dependencyResults.research.id, "research"); return "analysis-result"; } },
    { name: "Writer", role: "creative", run: async (objective, context) => { calls.push(`write:${objective}`); assert.equal(context.dependencyResults.analysis.result, "analysis-result"); return "draft"; } }
  ],
  coordinator: async (goal, outputs) => ({ goal, count: outputs.length, outputs: outputs.map(item => item.result) })
});

assert.deepEqual(ecosystem.list(), [
  { name: "researcher", role: "researcher" },
  { name: "analyst", role: "analyst" },
  { name: "writer", role: "creative" }
]);
assert.equal(ecosystem.get("RESEARCHER").name, "researcher");

const result = await ecosystem.run("create a report", {
  assignments: [
    { id: "research", agent: "researcher", objective: "collect facts" },
    { id: "analysis", agent: "analyst", objective: "analyze facts", dependsOn: ["research"] },
    { id: "writing", agent: "writer", objective: "write report", dependsOn: ["analysis"] }
  ]
});

assert.equal(result.type, "multi-agent-result");
assert.equal(result.result.count, 3);
assert.deepEqual(calls, ["research:collect facts", "analysis:analyze facts", "write:write report"]);

let parallel = 0;
let maxParallel = 0;
const parallelEco = createMultiAgentEcosystem({
  agents: [
    { name: "one", run: async () => { parallel++; maxParallel = Math.max(maxParallel, parallel); await new Promise(r => setTimeout(r, 5)); parallel--; return 1; } },
    { name: "two", run: async () => { parallel++; maxParallel = Math.max(maxParallel, parallel); await new Promise(r => setTimeout(r, 5)); parallel--; return 2; } }
  ],
  coordinator: async (_goal, outputs) => outputs
});
await parallelEco.run("parallel", { assignments: [{ agent: "one" }, { agent: "two" }] });
assert.equal(maxParallel, 2);

await assert.rejects(() => ecosystem.run("missing", { assignments: [{ agent: "unknown" }] }), /Agent not found/);
await assert.rejects(() => ecosystem.run("bad", { assignments: [{ id: "a", agent: "researcher", dependsOn: ["missing"] }] }), /Unknown assignment dependency/);
await assert.rejects(() => ecosystem.run("cycle", { assignments: [
  { id: "a", agent: "researcher", dependsOn: ["b"] },
  { id: "b", agent: "analyst", dependsOn: ["a"] }
] }), /cannot make further progress/);
await assert.rejects(() => ecosystem.run("too many", { maxAgents: 2, assignments: [
  { agent: "researcher" }, { agent: "analyst" }, { agent: "writer" }
] }), /maximum agent limit/);

console.log("PASS: HAIVA Stage 2 Phase C Multi-Agent Ecosystem tests");
