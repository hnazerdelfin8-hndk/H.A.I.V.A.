import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const v4 = readFileSync(new URL("../core/voice/v4/gateway.js", import.meta.url), "utf8");
const v1 = readFileSync(new URL("../core/voice/v1/capture-controller.js", import.meta.url), "utf8");
const v3 = readFileSync(new URL("../core/voice/v3/capture-controller.js", import.meta.url), "utf8");
const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");


test("V4 gateway is the microphone handoff authority", () => {
  assert.match(v4, /handoffToV1/);
  assert.match(v4, /handoffToV3/);
  assert.match(v4, /releaseFromV1/);
  assert.match(v4, /releaseFromV3/);
  assert.match(v4, /getMicOwner/);
});

test("V1 routes microphone acquisition through V4", () => {
  assert.match(v1, /from \"\.\.\/v4\/gateway\.js\"/);
  assert.match(v1, /handoffToV1\(/);
  assert.doesNotMatch(v1, /acquireCapture\(/);
});

test("V3 routes microphone acquisition through V4 and never calls V1", () => {
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
