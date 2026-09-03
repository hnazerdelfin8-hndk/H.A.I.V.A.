import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanProject } from "../../core/project/scanner.js";
import { analyzeProject } from "../../core/project/analyzer.js";
import { buildProjectContext } from "../../core/project/context-builder.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "haiva-phase4-"));

await fs.mkdir(path.join(root, "src"), { recursive: true });
await fs.mkdir(path.join(root, "tests"), { recursive: true });
await fs.mkdir(path.join(root, "node_modules", "ignored"), { recursive: true });
await fs.writeFile(path.join(root, "package.json"), "{}\n");
await fs.writeFile(path.join(root, "README.md"), "# Demo\n");
await fs.writeFile(path.join(root, "src", "index.js"), "export const ok = true;\n");
await fs.writeFile(path.join(root, "tests", "index.test.js"), "export {};\n");
await fs.writeFile(path.join(root, "node_modules", "ignored", "bad.js"), "broken\n");

const scan = await scanProject(root);
assert.equal(scan.fileCount, 4);
assert.ok(scan.entrypoints.includes("package.json"));
assert.ok(scan.entrypoints.includes("README.md"));
assert.ok(scan.entrypoints.includes("src/index.js"));
assert.ok(!scan.files.some((file) => file.path.includes("node_modules")));
assert.equal(scan.extensions[".js"], 2);

const analysis = analyzeProject(scan);
assert.equal(analysis.summary.runtimeFileCount, 2);
assert.equal(analysis.summary.testFileCount, 1);
assert.equal(analysis.signals.hasTests, true);
assert.equal(analysis.signals.hasConfig, true);
assert.equal(analysis.signals.hasDocumentation, true);
assert.deepEqual(analysis.risks, []);

const context = buildProjectContext(scan, analysis);
assert.equal(context.project.fileCount, 4);
assert.ok(context.importantFiles.includes("package.json"));
assert.ok(context.importantFiles.includes("tests/index.test.js"));
assert.match(context.promptContext, /Runtime files: 2/);
assert.match(context.promptContext, /Tests detected: yes/);
assert.match(context.promptContext, /Configuration detected: yes/);

await fs.rm(root, { recursive: true, force: true });
console.log("PASS: HAIVA Phase 4 Project Intelligence tests");
