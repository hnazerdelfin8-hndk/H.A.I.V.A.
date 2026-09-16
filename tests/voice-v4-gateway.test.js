import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const v4 = readFileSync(new URL("../core/voice/v4/gateway.js", import.meta.url), "utf8");
const v1 = readFileSync(new URL("../core/voice/v1/capture-controller.js", import.meta.url), "utf8");
const v3 = readFileSync(new URL("../core/voice/v3/capture-controller.js", import.meta.url), "utf8");
const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");

test("V4 has capture routing plus interrupt gateway without microphone implementation", () => {
  assert.match(v4, /handoffToV1/);
  assert.match(v4, /handoffToV3/);
  assert.match(v4, /releaseFromV1/);
  assert.match(v4, /releaseFromV3/);
  assert.match(v4, /registerVoiceInterruptHandler/);
  assert.match(v4, /routeV3InterruptCandidate/);
  assert.match(v4, /registerV3StopHandler/);
  assert.match(v4, /requestV3Stop/);
  assert.match(v4, /registerVoiceOutputStopHandler/);
  assert.match(v4, /requestVoiceOutputStop/);
  assert.match(v4, /getCaptureRoute/);
  assert.doesNotMatch(v4, /SpeechRecognizer/);
  assert.doesNotMatch(v4, /SpeechRecognition/);
  assert.doesNotMatch(v4, /startVoiceCapture/);
  assert.doesNotMatch(v4, /startV3VoiceCapture/);
});

test("V1 remains the normal capture worker and routes through V4", () => {
  assert.match(v1, /from \\"\\.\\.\\/v4\\/gateway\\.js\\"/);
  assert.match(v1, /handoffToV1\\(/);
  assert.doesNotMatch(v1, /handoffToV3\\(/);
});

test("V3 routes interruption candidates through V4 and never controls V1", () => {
  assert.match(v3, /from \\"\\.\\.\\/v4\\/gateway\\.js\\"/);
  assert.match(v3, /handoffToV3\\(/);
  assert.match(v3, /routeV3InterruptCandidate\\(/);
  assert.doesNotMatch(v3, /v1Capture/);
  assert.doesNotMatch(v3, /handoffToV1\\(/);
});

test("VoiceInteraction owns the semantic decision and receives V3 through V4", () => {
  assert.match(interaction, /createVoiceInteractionV3/);
  assert.match(interaction, /registerVoiceInterruptHandler/);
  assert.match(interaction, /handleV3InterruptCandidate/);
  assert.match(interaction, /this\.onBrainDecision/);
  assert.match(interaction, /requestV3Stop/);
  assert.match(interaction, /requestVoiceOutputStop/);
});
