import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const app = readFileSync(new URL("../core/app.js", import.meta.url), "utf8");
const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");
const v1 = readFileSync(new URL("../core/voice/v1/capture-controller.js", import.meta.url), "utf8");
const v3Logic = readFileSync(new URL("../core/voice/v3/interaction-v3.js", import.meta.url), "utf8");
const v3Capture = readFileSync(new URL("../core/voice/v3/capture-controller.js", import.meta.url), "utf8");
const androidBridge = readFileSync(new URL("../android/app/src/main/java/com/haiva/bridge/HaivaBridge.kt", import.meta.url), "utf8");
const androidActivity = readFileSync(new URL("../android/app/src/main/java/com/haiva/app/MainActivity.kt", import.meta.url), "utf8");

function nativeHandlerBody(source, eventName) {
  const escaped = eventName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = source.search(
    new RegExp(`window\\.addEventListener\\(\\s*[\"']${escaped}[\"']\\s*,`)
  );
  assert.notEqual(start, -1, `${eventName} handler missing`);

  const arrowStart = source.indexOf("=>", start);
  assert.notEqual(arrowStart, -1, `${eventName} handler arrow missing`);
  const openBrace = source.indexOf("{", arrowStart);
  assert.notEqual(openBrace, -1, `${eventName} handler body missing`);

  let depth = 0;
  let quote = null;
  let escapedChar = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escapedChar) {
        escapedChar = false;
        continue;
      }
      if (char === "\\") {
        escapedChar = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openBrace + 1, index);
    }
  }
  assert.fail(`${eventName} handler body is unbalanced`);
}

test("voice boundary: Voice Interaction owns the voice domain", () => {
  assert.match(app, /createVoiceInteraction/);
  assert.match(interaction, /v1Capture/);
  assert.match(interaction, /v3Capture/);
  assert.match(interaction, /VoiceLifecycleV2/);
  assert.match(interaction, /createVoiceInteractionV3/);
});

test("voice boundary: Core App has no direct V1/V2/V3 or recognizer wiring", () => {
  assert.doesNotMatch(app, /v1Capture/);
  assert.doesNotMatch(app, /v3Capture/);
  assert.doesNotMatch(app, /VoiceLifecycleV2/);
  assert.doesNotMatch(app, /createSpeechRecognition/);
  assert.doesNotMatch(app, /SpeechRecognition/);
  assert.doesNotMatch(app, /haiva:native-voice-/);
  assert.doesNotMatch(app, /haiva:v3-capture-/);
});

test("voice boundary: V1 is normal-input capture only", () => {
  assert.match(v1, /startVoiceCapture/);
  assert.match(v1, /stopVoiceCapture/);
  assert.match(v1, /SpeechRecognition/);
  assert.doesNotMatch(v1, /startV3VoiceCapture/);
  assert.doesNotMatch(v1, /stopV3VoiceCapture/);
});

test("voice boundary: V3 has a separate capture worker and separate native channel", () => {
  assert.match(v3Capture, /startV3VoiceCapture/);
  assert.match(v3Capture, /stopV3VoiceCapture/);
  assert.match(v3Capture, /SpeechRecognition/);
  assert.doesNotMatch(v3Logic, /SpeechRecognition/);
  assert.match(interaction, /bindV3CaptureEvents/);
});

test("voice boundary: V1 and V3 capture are exclusive", () => {
  assert.match(interaction, /this\.stopListening\(\);[\s\S]*v3Capture\.startCapture\(\)/);
  assert.match(interaction, /v3Capture\.stopCapture\(\);[\s\S]*this\.startListening\(\)/);
  assert.match(androidBridge, /startV3VoiceCapture\(\)/);
  assert.match(androidBridge, /stopV3VoiceCapture\(\)/);
  assert.match(androidActivity, /speechRecognizer: SpeechRecognizer\?/);
  assert.match(androidActivity, /v3SpeechRecognizer: SpeechRecognizer\?/);
});

test("voice boundary: native V1 events remain coordinated by Voice Interaction", () => {
  for (const eventName of ["haiva:native-voice-ready", "haiva:native-voice-begin"]) {
    const body = nativeHandlerBody(interaction, eventName);
    assert.match(body, /activateListening\(\)/);
    assert.match(body, /this\.listening = true/);
  }
  const segmentEndBody = nativeHandlerBody(interaction, "haiva:native-voice-segment-end");
  assert.doesNotMatch(segmentEndBody, /activateListening\(\)/);
  assert.match(segmentEndBody, /this\.listening = true/);
});

test("voice boundary: V3 native events are consumed only during speaking", () => {
  for (const eventName of ["haiva:v3-capture-ready", "haiva:v3-capture-begin", "haiva:v3-capture-result"]) {
    const body = nativeHandlerBody(interaction, eventName);
    assert.match(body, /this\.speaking/);
    assert.match(body, /acceptNativeV3CaptureEvent/);
  }
});
