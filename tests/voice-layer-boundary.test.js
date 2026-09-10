import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const v1 = readFileSync(new URL("../core/voice/v1/capture-controller.js", import.meta.url), "utf8");
const v3 = readFileSync(new URL("../core/voice/v3/barge-in-runtime.js", import.meta.url), "utf8");

 test("voice boundary: V1 owns capture primitives", () => {
  assert.match(v1, /startVoiceCapture/);
  assert.match(v1, /SpeechRecognition/);
  assert.match(v1, /haiva:v3-capture-request/);
});

test("voice boundary: V3 does not own SpeechRecognition or native capture", () => {
  assert.doesNotMatch(v3, /SpeechRecognition/);
  assert.doesNotMatch(v3, /startVoiceCapture/);
  assert.doesNotMatch(v3, /browserRecognizer/);
  assert.match(v3, /haiva:v3-capture-request/);
});

test("voice boundary: V3 owns interruption and delegates capture to V1", () => {
  assert.match(v3, /controller\.interrupt/);
  assert.match(v3, /haiva:v3-capture-stop/);
  assert.match(v3, /haiva:v1-capture-result/);
});
