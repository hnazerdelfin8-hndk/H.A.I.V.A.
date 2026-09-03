import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const workflowDir = path.join(root, ".github", "workflows");

const workflowEntries = await fs.readdir(workflowDir, { withFileTypes: true });
const workflowFiles = workflowEntries
  .filter((entry) => entry.isFile() && /\.(yml|yaml)$/i.test(entry.name))
  .map((entry) => entry.name);

assert.deepEqual(
  workflowFiles,
  ["haiva-verification.yml"],
  "production gate must have exactly one canonical workflow"
);

const workflow = await fs.readFile(path.join(workflowDir, "haiva-verification.yml"), "utf8");
assert.ok(workflow.includes("name: HAIVA Canonical Verification Gate"));
assert.ok(workflow.includes("branches: [haiva-core-vnext]"));
assert.ok(workflow.includes("permissions:\n  contents: read"));
assert.ok(workflow.includes("actions/checkout@v6"));
assert.ok(workflow.includes("actions/setup-node@v7"));
assert.ok(workflow.includes("node-version: 24"));
assert.ok(
  workflow.includes("run: npm run test:stage2c"),
  "canonical production gate must verify the complete Stage 2 Phase C chain"
);
assert.doesNotMatch(workflow, /node-version:\s*2?0\b/i, "Node 20 must not be used");
assert.doesNotMatch(workflow, /vercel/i, "Vercel must not be part of the HAIVA production path");

const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
assert.equal(packageJson.private, true, "HAIVA package must remain private");
assert.equal(typeof packageJson.scripts?.["test:phase9"], "string");
assert.equal(typeof packageJson.scripts?.["test:phase10"], "string");
assert.equal(typeof packageJson.scripts?.["test:stage2a"], "string");
assert.equal(
  typeof packageJson.scripts?.["test:stage2b"],
  "string",
  "Stage 2 Phase B verification command must exist"
);
assert.equal(
  typeof packageJson.scripts?.["test:stage2c"],
  "string",
  "Stage 2 Phase C verification command must exist"
);
assert.match(
  packageJson.scripts["test:stage2a"],
  /npm run test:phase10.*prompt-agent-builder\.test\.js/,
  "Stage 2 Phase A verification must preserve the full Phase 10 gate before capability tests"
);
assert.match(
  packageJson.scripts["test:stage2b"],
  /npm run test:stage2a.*autonomous-task-engine\.test\.js/,
  "Stage 2 Phase B verification must preserve the complete Stage 2 Phase A gate before Phase B tests"
);
assert.match(
  packageJson.scripts["test:stage2c"],
  /npm run test:stage2b.*multi-agent-ecosystem\.test\.js/,
  "Stage 2 Phase C verification must preserve the complete Stage 2 Phase B gate before Phase C tests"
);

const requiredFiles = [
  "core/agent/orchestrator.js",
  "core/agent/controlled-executor.js",
  "core/agent/verification.js",
  "core/agent/diagnostics.js",
  "core/memory/project-memory.js",
  "core/integration/core-pipeline.js",
  "core/integration/interface-pipeline.js",
  "core/capabilities/prompt-agent-builder.js",
  "tests/capabilities/prompt-agent-builder.test.js",
  "core/capabilities/autonomous-task-engine.js",
  "tests/capabilities/autonomous-task-engine.test.js",
  "core/capabilities/multi-agent-ecosystem.js",
  "tests/capabilities/multi-agent-ecosystem.test.js"
];
for (const relativePath of requiredFiles) {
  await fs.access(path.join(root, relativePath));
}

console.log("PASS: HAIVA Phase 10 Production Readiness tests");
