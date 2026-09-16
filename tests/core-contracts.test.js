import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = async path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("voice connector events have one Android producer and bounded recovery paths", async () => {
  const app = await read("core/app.js");
  const controls = await read("core/phase1-controls.js");
  const android = await read("android/app/src/main/java/com/haiva/app/MainActivity.kt");

  assert.doesNotMatch(app, /haiva:native-voice-timeout/);
  assert.match(app, /setState\("VOICE UNAVAILABLE"\)/);
  assert.match(controls, /haiva:native-voice-unavailable/);
  assert.match(android, /dispatchVoiceUnavailable/);
});

test("Core App connects to Voice Interaction only", async () => {
  const app = await read("core/app.js");
  const interaction = await read("core/voice/interaction.js");

  assert.match(app, /import \{ VoiceInteraction \} from "\.\/voice\/interaction\.js"/);
  assert.match(app, /new VoiceInteraction\(/);
  assert.doesNotMatch(app, /createVoiceInteraction\s*\(/);
  assert.doesNotMatch(app, /createSpeechRecognition/);
  assert.doesNotMatch(app, /v1Capture/);
  assert.doesNotMatch(app, /VoiceLifecycleV2/);
  assert.doesNotMatch(app, /haiva:native-voice-/);
  assert.match(interaction, /v1Capture/);
  assert.match(interaction, /VoiceLifecycleV2/);
  assert.match(interaction, /createVoiceInteractionV3/);
});

test("V1 capture remains internal to Voice Interaction", async () => {
  const app = await read("core/app.js");
  const v1 = await read("core/voice/v1/capture-controller.js");

  assert.doesNotMatch(app, /startCapture/);
  assert.doesNotMatch(app, /stopCapture/);
  assert.match(v1, /startVoiceCapture/);
  assert.match(v1, /stopVoiceCapture/);
  assert.doesNotMatch(v1, /haiva:v3-capture-request/);
  assert.doesNotMatch(v1, /haiva:v3-capture-stop/);
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
