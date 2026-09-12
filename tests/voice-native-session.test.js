import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");
const v1 = readFileSync(new URL("../core/voice/v1/capture-controller.js", import.meta.url), "utf8");
const android = readFileSync(new URL("../android/app/src/main/java/com/haiva/app/MainActivity.kt", import.meta.url), "utf8");


test("native session: VoiceInteraction creates a fresh capture session for every listening turn", () => {
  assert.match(interaction, /this\.captureSession = 0/);
  assert.match(interaction, /this\.activeCaptureSession = null/);
  assert.match(interaction, /const sessionId = `\$\{\+\+this\.captureSession\}`/);
  assert.match(interaction, /v1Capture\.startCapture\(sessionId\)/);
});

test("native session: stale callbacks are ignored by VoiceInteraction", () => {
  assert.match(interaction, /event\?\.detail\?\.sessionId/);
  assert.match(interaction, /eventSession === this\.activeCaptureSession/);
  assert.match(interaction, /!this\.isCurrentCaptureEvent\(event\)/);
});

test("native session: V1 forwards session identity without owning lifecycle", () => {
  assert.match(v1, /startCapture\(sessionId\)/);
  assert.match(v1, /stopCapture\(sessionId\)/);
  assert.match(v1, /detail: \{ text: normalized, source: "v1", sessionId \}/);
  assert.doesNotMatch(v1, /VoiceLifecycleV2/);
});

test("native session: Android adapter fences callbacks and emits recoverable outcomes", () => {
  assert.match(android, /nativeVoiceSessionId: String\?/);
  assert.match(android, /private fun current\(sessionId: String\?\)/);
  assert.match(android, /if \(!current\(sessionId\)\) return/);
  assert.match(android, /haiva:native-voice-recoverable/);
  assert.match(android, /haiva:native-voice-complete/);
  assert.match(android, /sessionId/);
});

test("native session: normal no-speech outcomes return to READY instead of VOICE ERROR", () => {
  assert.match(android, /ERROR_NO_MATCH/);
  assert.match(android, /ERROR_SPEECH_TIMEOUT/);
  assert.match(android, /dispatchVoiceCaptureComplete\("no_speech", sessionId\)/);
  assert.match(interaction, /haiva:native-voice-complete/);
  assert.match(interaction, /haiva:native-voice-recoverable/);
  assert.match(interaction, /this\.lifecycle\.finishReady\(\)/);
});
