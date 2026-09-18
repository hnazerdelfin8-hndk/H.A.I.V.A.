import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const controller = fs.readFileSync("core/voice/duplex-audio-controller.js", "utf8");
const interaction = fs.readFileSync("core/voice/interaction.js", "utf8");
const bridge = fs.readFileSync("android/app/src/main/java/com/haiva/bridge/HaivaBridge.kt", "utf8");
const nativeMonitor = fs.readFileSync("android/app/src/main/java/com/haiva/app/DuplexAudioMonitor.kt", "utf8");

test("legacy duplex controller exposes its native interrupt monitor contract", () => {
  assert.match(controller, /startDuplexInterruptMonitor/);
  assert.match(controller, /stopDuplexInterruptMonitor/);
  assert.match(controller, /haiva:duplex-interrupt-detected/);
  assert.match(controller, /onInterruptDetected/);
});

test("canonical interaction owns duplex startup and interruption fencing", () => {
  assert.match(interaction, /new DuplexController/);
  assert.match(interaction, /this\.duplex\.start\(speakingTurn\)/);
  assert.match(interaction, /duplexInterruptPending/);
});

test("native bridge exposes the legacy monitor only as a migration boundary", () => {
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
