import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const app = readFileSync(new URL("../core/app.js", import.meta.url), "utf8");
const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");
const v1 = readFileSync(new URL("../core/voice/v1/capture-controller.js", import.meta.url), "utf8");
const v3 = readFileSync(new URL("../core/voice/v3/barge-in-runtime.js", import.meta.url), "utf8");

test("voice boundary: Voice Interaction owns the voice domain", () => {
  assert.match(app, /createVoiceInteraction/);
  assert.match(interaction, /v1Capture/);
  assert.match(interaction, /VoiceLifecycleV2/);
  assert.match(interaction, /createVoiceInteractionV3/);
});

test("voice boundary: Core App has no direct V1/V2/V3 or recognizer wiring", () => {
  assert.doesNotMatch(app, /v1Capture/);
  assert.doesNotMatch(app, /VoiceLifecycleV2/);
  assert.doesNotMatch(app, /createSpeechRecognition/);
  assert.doesNotMatch(app, /SpeechRecognition/);
  assert.doesNotMatch(app, /haiva:native-voice-/);
});

test("voice boundary: V1 is a capture worker only", () => {
  assert.match(v1, /startVoiceCapture/);
  assert.match(v1, /stopVoiceCapture/);
  assert.match(v1, /SpeechRecognition/);
  assert.doesNotMatch(v1, /haiva:v3-capture-request/);
  assert.doesNotMatch(v1, /haiva:v3-capture-stop/);
});

test("voice boundary: native capture events do not authorize V2 lifecycle", () => {
  assert.match(interaction, /haiva:native-voice-ready/);
  assert.match(interaction, /haiva:native-voice-begin/);
  assert.match(interaction, /haiva:native-voice-segment-end/);
  assert.doesNotMatch(interaction, /addEventListener\("haiva:native-voice-ready",[\s\S]*?\{[^}]*activateListening\(\)/);
  assert.doesNotMatch(interaction, /addEventListener\("haiva:native-voice-begin",[\s\S]*?\{[^}]*activateListening\(\)/);
  assert.doesNotMatch(interaction, /addEventListener\("haiva:native-voice-segment-end",[\s\S]*?\{[^}]*activateListening\(\)/);
});

test("voice boundary: V3 does not own SpeechRecognition or native capture", () => {
  assert.doesNotMatch(v3, /SpeechRecognition/);
  assert.doesNotMatch(v3, /startVoiceCapture/);
  assert.doesNotMatch(v3, /browserRecognizer/);
});
