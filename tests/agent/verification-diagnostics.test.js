// =========================================
// H.A.I.V.A. PHASE 6 — VERIFICATION & DIAGNOSTICS TESTS
// =========================================

import assert from "node:assert/strict";
import { verifyResult, runVerification } from "../../core/agent/verification.js";
import { diagnoseFailure, recoverFromFailure } from "../../core/agent/diagnostics.js";

const passing = verifyResult({ ok: true }, {
  required: true,
  checks: [value => value.ok === true]
});
assert.equal(passing.passed, true);
assert.equal(passing.evidence.checked, 1);

const failing = verifyResult({ ok: false }, {
  required: true,
  checks: [value => value.ok === true]
});
assert.equal(failing.passed, false);
assert.equal(failing.evidence.failures.length, 1);

const asyncVerification = await runVerification(
  async target => ({ passed: target.ready === true, evidence: { ready: target.ready } }),
  { ready: true }
);
assert.equal(asyncVerification.passed, true);

const diagnosis = diagnoseFailure(new Error("ENOENT: no such file or directory"), { step: "scan" });
assert.equal(diagnosis.category, "missing_path");
assert.equal(diagnosis.retryable, false);
assert.match(diagnosis.recommendation, /Inspect the referenced path/);

let attempts = 0;
const recovery = await recoverFromFailure(new Error("timeout while waiting"), {
  maxAttempts: 2,
  recover: async ({ attempt }) => {
    attempts = attempt;
    if (attempt === 1) throw new Error("timeout again");
    return "recovered";
  }
});
assert.equal(recovery.recovered, true);
assert.equal(recovery.attempts, 2);
assert.equal(attempts, 2);
assert.equal(recovery.result, "recovered");

const blockedRecovery = await recoverFromFailure(new Error("approval required for tool: x"), {
  maxAttempts: 2,
  recover: async () => "must-not-run"
});
assert.equal(blockedRecovery.recovered, false);
assert.equal(blockedRecovery.attempts, 0);
assert.equal(blockedRecovery.diagnosis.category, "approval");

console.log("PASS: HAIVA Phase 6 Verification & Diagnostics tests");
