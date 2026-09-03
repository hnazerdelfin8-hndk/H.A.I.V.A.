// =========================================
// H.A.I.V.A. STAGE 4D — VOICE → FULL CORE PIPELINE TESTS
// =========================================

import assert from "node:assert/strict";
import { HAIVAAssistant } from "../../core/assistant.js";

const assistant = new HAIVAAssistant();
const result = await assistant.respond("status");

assert.equal(typeof result, "string");
assert.ok(result.length > 0);
assert.equal(assistant.processing, false);

console.log("PASS: HAIVA Stage 4D Voice → Full H.A.I.V.A. Pipeline tests");
