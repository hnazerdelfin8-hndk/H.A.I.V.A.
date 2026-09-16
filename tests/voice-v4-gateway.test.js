import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const v4 = readFileSync(new URL("../core/voice/v4/gateway.js", import.meta.url), "utf8");
const v1 = readFileSync(new URL("../core/voice/v1/capture-controller.js", import.meta.url), "utf8");
const v3 = readFileSync(new URL("../core/voice/v3/capture-controller.js", import.meta.url), "utf8");
const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");


test("V4 is routing-only and exposes no microphone implementation", () => {
  assert.match(v4, /handoffToV1/);
  assert.match(v4, /handoffToV3/);
  assert.match(v4, /releaseFromV1/);
  assert.match(v4, /releaseFromV3/);
  assert.match(v4, /getCaptureRoute/);
  assert.doesNotMatch(v4, /SpeechRecognizer/);
  assert.doesNotMatch(v4, /SpeechRecognition/);
  assert.doesNotMatch(v4, /startVoiceCapture/);
  assert.doesNotMatch(v4, /startV3VoiceCapture/);
});

test("V1 remains the normal capture worker and routes through V4", () => {
  assert.match(v1, /from \"\.\.\/v4\/gateway\.js\"/);
  assert.match(v1, /handoffToV1\(/);
  assert.doesNotMatch(v1, /handoffToV3\(/);
});

test("V3 remains the interruption worker and routes through V4", () => {
  assert.match(v3, /from \"\.\.\/v4\/gateway\.js\"/);
  assert.match(v3, /handoffToV3\(/);
  assert.doesNotMatch(v3, /v1Capture/);
  assert.doesNotMatch(v3, /handoffToV1\(/);
});

test("VoiceInteraction remains the only external voice-domain orchestrator", () => {
  assert.match(interaction, /createVoiceInteractionV3/);
  assert.match(interaction, /v1Capture/);
  assert.match(interaction, /v3Capture/);
});
