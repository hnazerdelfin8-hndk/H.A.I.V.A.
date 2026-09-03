// =========================================
// H.A.I.V.A. STAGE 4F — END-TO-END VOICE VERIFICATION
// =========================================

import assert from "node:assert/strict";
import { CONFIG } from "../../core/config.js";
import { containsWakeWord, removeWakeWord, normalizeSpeech } from "../../core/ui-bridge.js";
import { createSpeechRecognition } from "../../core/voice/speech-to-text.js";
import { speakText } from "../../core/voice/text-to-speech.js";
import { createInterfacePipeline } from "../../core/integration/interface-pipeline.js";
import { createMemoryStore } from "../../core/memory/project-memory.js";

assert.equal(CONFIG.features.voice, true);
assert.equal(CONFIG.features.wakeWord, true);
assert.equal(CONFIG.features.textToSpeech, true);

const spoken = normalizeSpeech("Yo Haiva, check system status");
assert.equal(containsWakeWord(spoken), true);
const command = removeWakeWord(spoken);
assert.equal(command, "check system status");

assert.equal(typeof createSpeechRecognition, "function");
assert.equal(typeof speakText, "function");
await speakText("");

const memory = createMemoryStore();
const pipeline = createInterfacePipeline({
  memory,
  request: async input => ({ success: true, response: `Verified: ${input}` })
});
const result = await pipeline.run(command);
assert.equal(result.ok, true);
assert.equal(result.verification.passed, true);
assert.equal(result.task.result.response, "Verified: check system status");

console.log("PASS: HAIVA Stage 4F End-to-End Voice Verification tests");
