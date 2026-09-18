import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const controller = fs.readFileSync("core/voice/duplex-audio-controller.js", "utf8");
const v3Capture = fs.readFileSync("core/voice/v3-capture-controller.js", "utf8");
const interaction = fs.readFileSync("core/voice/interaction.js", "utf8");
const bridge = fs.readFileSync("android/app/src/main/java/com/haiva/bridge/HaivaBridge.kt", "utf8");
const nativeMonitor = fs.readFileSync("android/app/src/main/java/com/haiva/app/DuplexAudioMonitor.kt", "utf8");

test("duplex controller exposes a native interrupt monitor contract", () => {
  assert.match(controller, /startDuplexInterruptMonitor/);
  assert.match(controller, /stopDuplexInterruptMonitor/);
  assert.match(controller, /haiva:duplex-interrupt-detected/);
  assert.match(controller, /onInterruptDetected/);
});

test("duplex controller requires native ready before accepting interrupt events", () => {
  assert.match(controller, /this\.ready = false/);
  assert.match(controller, /if \(!this\.active \|\| !this\.ready\) return;/);
  assert.match(controller, /this\.ready = true;/);
  assert.match(controller, /isReady\(\)/);
});

test("duplex controller fences native startup errors", () => {
  assert.match(controller, /MONITOR_ERROR/);
  assert.match(controller, /this\.active = false;/);
  assert.match(controller, /this\.ready = false;/);
  assert.match(controller, /this\.turn = null;/);
});

test("V3 prefers duplex speech onset before full STT", () => {
  assert.match(v3Capture, /DuplexAudioController/);
  assert.match(v3Capture, /startInterruptMonitor/);
  assert.match(v3Capture, /startRecognitionAfterDuplex/);
  assert.match(v3Capture, /haiva:v3-duplex-speech-start/);
  assert.doesNotMatch(v3Capture, /SpeechRecognizer|SpeechRecognition/);
});

test("VoiceInteraction fences TTS completion during duplex interruption", () => {
  assert.match(interaction, /duplexInterruptPending/);
  assert.match(interaction, /requestVoiceOutputStop\("duplex-speech-start"\)/);
  assert.match(interaction, /startRecognitionAfterDuplex/);
  assert.match(interaction, /if \(this\.duplexInterruptPending\) return false/);
});

test("native bridge exposes duplex monitor controls", () => {
  assert.match(bridge, /@JavascriptInterface\s+fun startDuplexInterruptMonitor/);
  assert.match(bridge, /@JavascriptInterface\s+fun stopDuplexInterruptMonitor/);
});

test("native duplex monitor uses AudioRecord with echo/noise processing", () => {
  assert.match(nativeMonitor, /AudioRecord\.Builder/);
  assert.match(nativeMonitor, /VOICE_RECOGNITION/);
  assert.match(nativeMonitor, /AcousticEchoCanceler/);
  assert.match(nativeMonitor, /NoiseSuppressor/);
  assert.match(nativeMonitor, /AutomaticGainControl/);
  assert.match(nativeMonitor, /haiva:duplex-interrupt-detected/);
  assert.match(nativeMonitor, /FRAME_MS = 20/);
});
