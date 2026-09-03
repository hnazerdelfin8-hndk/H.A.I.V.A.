// =========================================
// H.A.I.V.A. STAGE 4E — RESPONSE → VOICE TESTS
// =========================================

import assert from "node:assert/strict";
import { speakText } from "../../core/voice/text-to-speech.js";

assert.equal(typeof speakText, "function");
assert.ok(speakText("") instanceof Promise);
await speakText("");

console.log("PASS: HAIVA Stage 4E Response → Voice tests");
