// =========================================
// H.A.I.V.A. STAGE 2 — PHASE A TESTS
// =========================================

import assert from "node:assert/strict";
import { createPromptAgentBuilder } from "../../core/capabilities/prompt-agent-builder.js";

const builder = createPromptAgentBuilder();

const prompt = builder.buildPrompt({
  goal: "Research an automation opportunity",
  role: "researcher",
  context: "The target is a small business",
  constraints: ["Use verifiable information", "Return concise findings"],
  output: "report"
});

assert.equal(prompt.type, "prompt-specification");
assert.equal(prompt.role, "researcher");
assert.equal(prompt.goal, "Research an automation opportunity");
assert.equal(prompt.constraints.length, 2);
assert.match(prompt.instructions.join(" "), /Research an automation opportunity/);

const agent = builder.buildAgent({
  name: "Research Agent",
  goal: "Research an automation opportunity",
  role: "researcher",
  tools: ["web-search", "document-reader"],
  constraints: ["Do not invent sources"],
  output: "report"
});

assert.equal(agent.type, "agent-specification");
assert.equal(agent.tools.length, 2);
assert.equal(agent.prompt.type, "prompt-specification");

assert.throws(() => builder.buildPrompt({ goal: "" }), /Goal is required/);
assert.throws(() => builder.buildPrompt({ goal: "x", role: "unknown" }), /Unsupported role/);
assert.throws(() => builder.buildPrompt({ goal: "x", output: "binary" }), /Unsupported output/);
assert.throws(() => builder.buildPrompt({ goal: "x", constraints: "bad" }), /constraints must be an array/);
assert.throws(() => builder.buildAgent({ goal: "x" }), /Agent name is required/);

console.log("PASS: HAIVA Stage 2 Phase A Prompt & Agent Builder tests");
