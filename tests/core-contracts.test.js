import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = async path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("voice connector events have one Android producer and bounded recovery paths", async () => {
  const app = await read("core/app.js");
  const controls = await read("core/phase1-controls.js");
  const android = await read("android/app/src/main/java/com/haiva/app/MainActivity.kt");

  assert.match(app, /haiva:native-voice-timeout/);
  assert.match(app, /setState\("VOICE UNAVAILABLE"\)/);
  assert.match(controls, /haiva:native-voice-unavailable/);
  assert.match(android, /dispatchVoiceUnavailable/);
});

test("voice state machine has one core orchestration path", async () => {
  const app = await read("core/app.js");
  const v1 = await read("core/voice/v1/capture-controller.js");
  const v2 = await read("core/voice/v2/lifecycle-coordinator.js");

  assert.match(app, /setState\(/);
  assert.match(app, /v1Capture\.startCapture/);
  assert.match(app, /v1Capture\.stopCapture/);
  assert.doesNotMatch(app, /window\.HaivaBridge\.startVoiceCapture/);
  assert.doesNotMatch(app, /window\.HaivaBridge\.stopVoiceCapture/);
  assert.match(v1, /startVoiceCapture/);
  assert.match(v1, /stopVoiceCapture/);
  assert.match(v2, /class VoiceLifecycleV2/);
  assert.match(v2, /beginThinking/);
  assert.match(v2, /beginSpeaking/);
});

test("AI orchestration has a bounded remote request and no retry storm", async () => {
  const source = await read("core/orchestrator/index.js");
  assert.match(source, /AbortController/);
  assert.match(source, /AI_REQUEST_TIMEOUT_MS/);
  assert.match(source, /DEFAULT_MAX_RETRIES = 0/);
});

test("orchestrator executes through the configured chat gateway", async () => {
  const source = await read("core/orchestrator/index.js");
  assert.match(source, /CONFIG\.api\.chatEndpoint/);
  assert.match(source, /fetch\(CONFIG\.api\.chatEndpoint/);
});
