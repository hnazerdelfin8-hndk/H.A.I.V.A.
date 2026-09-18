import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");
const android = readFileSync(new URL("../android/app/src/main/java/com/haiva/app/MainActivity.kt", import.meta.url), "utf8");

test("duplex voice uses one native recognizer while migration remains fenced", () => {
  assert.equal((android.match(/SpeechRecognizer\.createSpeechRecognizer\(this\)/g) || []).length, 1);
  assert.doesNotMatch(android, /v3SpeechRecognizer/);
  assert.match(android, /NativeCaptureMode\.NORMAL/);
  assert.match(android, /NativeCaptureMode\.INTERRUPT/);
  assert.match(android, /startNativeRecognitionWithMode/);
});

test("V3 is logical only and duplex owns the interaction audio boundary", () => {
  assert.doesNotMatch(interaction, /v1Capture|v3Capture|handoffToV[13]|requestV3Stop/);
  assert.match(interaction, /new DuplexController/);
  assert.match(interaction, /this\.duplex\.start\(speakingTurn\)/);
  assert.match(interaction, /createVoiceInteractionV3/);
});

test("speaking keeps the canonical duplex capture path armed during TTS", () => {
  assert.match(interaction, /this\.lifecycle\.beginSpeaking\(\);[\s\S]*this\.interruption\.beginMonitoring\(speakingTurn\)/);
  assert.match(interaction, /this\.duplex\.start\(speakingTurn\)/);
  assert.match(interaction, /await speak\(text\)/);
  assert.doesNotMatch(interaction, /requestVoiceOutputStop\("duplex-speech-start"\)/);
});
