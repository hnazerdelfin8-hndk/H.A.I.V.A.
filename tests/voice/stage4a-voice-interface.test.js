// =========================================
// H.A.I.V.A. STAGE 4A — VOICE INTERFACE CORE TESTS
// =========================================

import assert from "node:assert/strict";
import { containsWakeWord, normalizeSpeech, removeWakeWord } from "../../core/ui-bridge.js";
import { createSpeechRecognition } from "../../core/voice/speech-to-text.js";
import { speakText } from "../../core/voice/text-to-speech.js";

assert.equal(normalizeSpeech("  Hello,   Master!  "), "hello master");
assert.equal(containsWakeWord("Yo Haiva, status"), true);
assert.equal(removeWakeWord("Yo Haiva, status"), "status");
assert.equal(typeof createSpeechRecognition, "function");
assert.equal(typeof speakText, "function");

console.log("PASS: HAIVA Stage 4A Voice Interface Core tests");
