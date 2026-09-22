import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

test("canonical duplex audio boundary uses AudioRecord with AEC, VAD, and ASR handoff", () => {
  const monitor = readFileSync("android/app/src/main/java/com/haiva/app/DuplexAudioMonitor.kt", "utf8");
  const bridge = readFileSync("android/app/src/main/java/com/haiva/bridge/HaivaBridge.kt", "utf8");
  const interaction = readFileSync("core/voice/interaction/index.js", "utf8");
  const captureAdapter = readFileSync("core/voice/capture/native.js", "utf8");
  assert.match(monitor, /AudioRecord\.Builder/);
  assert.match(monitor, /AcousticEchoCanceler/);
  assert.match(monitor, /NoiseSuppressor/);
  assert.match(monitor, /AutomaticGainControl/);
  assert.match(monitor, /haiva:duplex-barge-in/);
  assert.match(monitor, /FRAME_MS = 20/);
  assert.match(bridge, /fun startDuplexAudio/);
  assert.match(bridge, /fun stopDuplexAudio/);
  assert.match(interaction, /this\.capture\.start\(\)/);
  assert.match(captureAdapter, /startVoiceCapture/);
});
