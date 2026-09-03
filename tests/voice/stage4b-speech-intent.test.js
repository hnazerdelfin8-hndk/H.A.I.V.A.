// =========================================
// H.A.I.V.A. STAGE 4B — SPEECH → INTENT TESTS
// =========================================

import assert from "node:assert/strict";
import { containsWakeWord, normalizeSpeech, removeWakeWord } from "../../core/ui-bridge.js";

function speechToIntent(transcript) {
  const normalized = normalizeSpeech(transcript);
  if (!normalized) return { type: "empty", text: "" };
  if (containsWakeWord(normalized)) {
    const command = removeWakeWord(normalized);
    return command ? { type: "command", text: command } : { type: "wake", text: "" };
  }
  return { type: "command", text: normalized };
}

assert.deepEqual(speechToIntent("Yo Haiva, check status"), {
  type: "command",
  text: "check status"
});
assert.deepEqual(speechToIntent("Yo Haiva"), { type: "wake", text: "" });
assert.deepEqual(speechToIntent("  "), { type: "empty", text: "" });

console.log("PASS: HAIVA Stage 4B Speech → Intent tests");
