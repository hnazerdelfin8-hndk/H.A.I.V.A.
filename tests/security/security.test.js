import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { classifyAction, requiresApproval } from "../../core/agent/approval.js";

const root = process.cwd();
const ignoredDirs = new Set([".git", ".next", "node_modules", "dist", "build", "coverage", ".vercel"]);
const ignoredFiles = new Set(["package-lock.json", "npm-shrinkwrap.json"]);

const secretPatterns = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/
];

async function walk(current, results = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute, results);
    } else if (entry.isFile() && !ignoredFiles.has(entry.name)) {
      results.push(absolute);
    }
  }
  return results;
}

async function readText(file) {
  const buffer = await fs.readFile(file);
  if (buffer.includes(0)) return null;
  return buffer.toString("utf8");
}

const gitignore = await fs.readFile(path.join(root, ".gitignore"), "utf8");
for (const rule of [".env", ".env.*", ".vercel/", "credentials/", "secrets/"]) {
  assert.ok(gitignore.includes(rule), `.gitignore missing security rule: ${rule}`);
}

const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
assert.equal(packageJson.private, true, "package must remain private");

const files = await walk(root);
const findings = [];
for (const file of files) {
  const text = await readText(file);
  if (text === null) continue;
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      findings.push(path.relative(root, file));
      break;
    }
  }
}
assert.deepEqual(findings, [], `high-confidence secret pattern found in: ${findings.join(", ")}`);

const approvalActions = ["production_deploy", "delete", "destructive_delete", "database_migration", "credential_change"];
for (const type of approvalActions) {
  assert.equal(classifyAction({ type }), "approval", `${type} must require approval`);
  assert.equal(requiresApproval({ type }), true, `${type} must require approval`);
}

assert.equal(classifyAction({ type: "inspect" }), "safe");
assert.equal(classifyAction({ type: "write" }), "controlled");

console.log("PASS: HAIVA Security Hardening tests");
