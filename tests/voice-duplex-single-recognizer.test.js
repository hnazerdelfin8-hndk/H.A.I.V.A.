import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");
const v3Capture = readFileSync(new URL("../core/voice/v3-capture-controller.js", import.meta.url), "utf8");
const v4 = readFileSync(new URL("../core/voice/gateway.js", import.meta.url), "utf8");
const android = readFileSync(new URL("../android/app/src/main/java/com/haiva/app/MainActivity.kt", import.meta.url), "utf8");

test("duplex voice uses one native recognizer with V1/V3 logical routing", () => {
  assert.equal((android.match(/SpeechRecognizer\.createSpeechRecognizer\(this\)/g) || []).length, 1);
  assert.doesNotMatch(android, /v3SpeechRecognizer/);
  assert.match(android, /NativeCaptureMode\.NORMAL/);
  assert.match(android, /NativeCaptureMode\.INTERRUPT/);
  assert.match(android, /startNativeRecognitionWithMode/);
});

test("V3 capture reaches Android only through the V4 route", () => {
  assert.match(v3Capture, /handoffToV3/);
  assert.match(v3Capture, /releaseFromV3/);
  assert.match(v3Capture, /HaivaBridge\?\.startV3VoiceCapture/);
  assert.doesNotMatch(v3Capture, /SpeechRecognizer|SpeechRecognition/);
  assert.match(v4, /handoffToV3/);
});

test("speaking arms V3 before TTS and does not create a second capture path", () => {
  assert.match(interaction, /this\.lifecycle\.beginSpeaking\(\);[\s\S]*this\.interruption\.beginMonitoring\(speakingTurn\);[\s\S]*v3Capture\.startCapture\(speakingTurn\);[\s\S]*await speak\(text\)/);
  assert.match(interaction, /haiva:v3-duplex-speech-start/);
  assert.match(interaction, /requestVoiceOutputStop\("duplex-speech-start"\)/);
  assert.match(interaction, /v3Capture\.startRecognitionAfterDuplex\(\)/);
  assert.doesNotMatch(interaction, /native-speech-start[\s\S]*v3Capture\.startCapture/);
  assert.match(interaction, /requestV3Stop\("voice-interrupt"\)/);
  assert.match(interaction, /requestVoiceOutputStop\("voice-interrupt"\)/);
});
