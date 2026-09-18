import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const v4 = readFileSync(new URL("../core/voice/gateway.js", import.meta.url), "utf8");
const v1 = readFileSync(new URL("../core/voice/v1-capture-controller.js", import.meta.url), "utf8");
const v3 = readFileSync(new URL("../core/voice/v3-capture-controller.js", import.meta.url), "utf8");
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

test("VoiceInteraction uses canonical Duplex and keeps V3 logical", () => {
  assert.match(interaction, /new DuplexController/);
  assert.match(interaction, /createVoiceInteractionV3/);
  assert.match(interaction, /handleV3InterruptCandidate/);
  assert.doesNotMatch(interaction, /v1Capture|v3Capture|registerVoiceInterruptHandler|requestV3Stop/);
});
