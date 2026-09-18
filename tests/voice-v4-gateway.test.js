import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const v4 = readFileSync(new URL("../core/voice/gateway.js", import.meta.url), "utf8");
const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");

test("V4 is an interrupt/output gateway without capture-worker routing", () => {
  assert.match(v4, /registerVoiceInterruptHandler/);
  assert.match(v4, /routeV3InterruptCandidate/);
  assert.match(v4, /registerV3StopHandler/);
  assert.match(v4, /requestV3Stop/);
  assert.match(v4, /registerVoiceOutputStopHandler/);
  assert.match(v4, /requestVoiceOutputStop/);
  assert.doesNotMatch(v4, /handoffToV1|handoffToV3|releaseFromV1|releaseFromV3/);
  assert.doesNotMatch(v4, /SpeechRecognizer|SpeechRecognition|startVoiceCapture|startV3VoiceCapture/);
});

test("VoiceInteraction uses canonical Duplex and keeps Barge-in logical", () => {
  assert.match(interaction, /new DuplexController/);
  assert.match(interaction, /createBargeInCoordinator/);
  assert.match(interaction, /handleBargeInCandidate/);
  assert.doesNotMatch(interaction, /v1Capture|v3Capture|registerVoiceInterruptHandler|requestV3Stop/);
});
