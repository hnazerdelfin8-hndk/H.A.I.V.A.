import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const app = readFileSync(new URL("../core/app.js", import.meta.url), "utf8");
const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");
const handoff = readFileSync(new URL("../core/voice/capture-handoff.js", import.meta.url), "utf8");
const v1 = readFileSync(new URL("../core/voice/v1/capture-controller.js", import.meta.url), "utf8");
const v3Logic = readFileSync(new URL("../core/voice/v3/interaction-v3.js", import.meta.url), "utf8");
const v3Capture = readFileSync(new URL("../core/voice/v3/capture-controller.js", import.meta.url), "utf8");
const androidBridge = readFileSync(new URL("../android/app/src/main/java/com/haiva/bridge/HaivaBridge.kt", import.meta.url), "utf8");
const androidActivity = readFileSync(new URL("../android/app/src/main/java/com/haiva/app/MainActivity.kt", import.meta.url), "utf8");

function nativeHandlerBody(source, eventName) {
  const escaped = eventName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&");
  const start = source.search(new RegExp(`window\\.addEventListener\\(\\s*[\\\"']${escaped}[\\\"']\\s*,`));
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
    if (lineComment) { if (char === "\n") lineComment = false; continue; }
    if (blockComment) { if (char === "*" && next === "/") { blockComment = false; index += 1; } continue; }
    if (quote) {
      if (escapedChar) { escapedChar = false; continue; }
      if (char === "\\") { escapedChar = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (char === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{") { depth += 1; continue; }
    if (char === "}") { depth -= 1; if (depth === 0) return source.slice(openBrace + 1, index); }
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
  assert.match(v1, /registerCaptureOwner\(\"v1\"/);
  assert.doesNotMatch(v1, /startV3VoiceCapture/);
  assert.doesNotMatch(v1, /stopV3VoiceCapture/);
  assert.doesNotMatch(v1, /v3Capture/);
});

test("voice boundary: V3 has a separate capture worker and separate native channel", () => {
  assert.match(v3Capture, /startV3VoiceCapture/);
  assert.match(v3Capture, /stopV3VoiceCapture/);
  assert.match(v3Capture, /SpeechRecognition/);
  assert.match(v3Capture, /registerCaptureOwner\(\"v3\"/);
  assert.doesNotMatch(v3Capture, /startVoiceCapture/);
  assert.doesNotMatch(v3Capture, /stopVoiceCapture/);
  assert.doesNotMatch(v3Logic, /SpeechRecognition/);
  assert.match(interaction, /bindV3CaptureEvents/);
});

test("voice boundary: normal loop is coordinated by VoiceInteraction", () => {
  assert.match(interaction, /this\.lifecycle\.beginSpeaking\(\);[\s\S]*v3Capture\.startCapture\(\)/);
  assert.match(interaction, /this\.interruption\.stopMonitoring\(speakingTurn\)/);
  assert.match(interaction, /v3Capture\.stopCapture\(\)/);
  assert.match(interaction, /this\.startListening\(\)/);
  assert.doesNotMatch(interaction, /setV1HandoffHandler/);
  assert.doesNotMatch(interaction, /handoffToV1/);
  assert.doesNotMatch(interaction, /resumeV1AfterV3/);
  assert.doesNotMatch(v3Capture, /handoffToV1/);
  assert.doesNotMatch(v3Capture, /setV1HandoffHandler/);
  assert.doesNotMatch(v3Logic, /HANDOFF/);
  assert.doesNotMatch(v1, /v3Capture/);
});

test("voice boundary: V3 reports interruption only and never routes to V1", () => {
  assert.match(v3Logic, /route: \"none\"/);
  // Accept either a function declaration/method call form or a named function
  // expression. The boundary is semantic: V3 must expose an interrupt operation,
  // not depend on one exact JavaScript formatting style.
  assert.match(v3Logic, /(?:const\s+interrupt\s*=\s*\(|interrupt\s*\()/);
  assert.doesNotMatch(v3Capture, /handoffToV1/);
  assert.doesNotMatch(v3Capture, /handoffToV1Handler/);
  assert.doesNotMatch(v3Logic, /prepareHandoffToV1/);
  assert.doesNotMatch(v3Logic, /completeHandoff/);
  assert.doesNotMatch(v3Logic, /HANDOFF/);
});

test("voice boundary: V1 and V3 use one exclusive immediate capture handoff barrier", () => {
  assert.match(handoff, /One microphone owner at a time/);
  assert.doesNotMatch(handoff, /HANDOFF_DELAY_MS/);
  assert.doesNotMatch(handoff, /generation/);
  assert.doesNotMatch(handoff, /setTimeout/);
  assert.doesNotMatch(handoff, /pendingTimer/);
  assert.match(handoff, /registerCaptureOwner/);
  assert.match(handoff, /acquireCapture/);
  assert.match(handoff, /releaseCapture/);
  assert.match(handoff, /owner = nextOwner;[\s\S]*startCapture\(\)/);
  assert.match(v3Capture, /releaseCapture\(\"v3\", stopUnderlyingCapture\)/);
  assert.match(v1, /acquireCapture\(\"v1\"/);
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
