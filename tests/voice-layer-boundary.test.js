import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const app = readFileSync(new URL("../core/app.js", import.meta.url), "utf8");
const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");
const v1 = readFileSync(new URL("../core/voice/v1/capture-controller.js", import.meta.url), "utf8");
const v3 = readFileSync(new URL("../core/voice/v3/barge-in-runtime.js", import.meta.url), "utf8");

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
  let templateExpressionDepth = 0;

  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\\n") lineComment = false;
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
      if (char === "\\\\") {
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

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBrace + 1, index);
      }
    }
  }

  assert.fail(`${eventName} handler body is unbalanced`);
}

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

test("voice boundary: native capture events are coordinated by Voice Interaction and may activate V2 lifecycle", () => {
  for (const eventName of [
    "haiva:native-voice-ready",
    "haiva:native-voice-begin"
  ]) {
    const body = nativeHandlerBody(interaction, eventName);
    assert.match(body, /activateListening\(\)/);
    assert.match(body, /this\.listening = true/);
  }

  const segmentEndBody = nativeHandlerBody(interaction, "haiva:native-voice-segment-end");
  assert.doesNotMatch(segmentEndBody, /activateListening\(\)/);
  assert.match(segmentEndBody, /this\.listening = true/);
});

test("voice boundary: V3 does not own SpeechRecognition or native capture", () => {
  assert.doesNotMatch(v3, /SpeechRecognition/);
  assert.doesNotMatch(v3, /startVoiceCapture/);
  assert.doesNotMatch(v3, /browserRecognizer/);
});
