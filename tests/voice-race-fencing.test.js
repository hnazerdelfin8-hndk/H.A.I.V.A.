import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../core/ui-bridge.js", import.meta.url), "utf8");
const native = readFileSync(new URL("../android/app/src/main/java/com/haiva/app/MainActivity.kt", import.meta.url), "utf8");
const gateway = readFileSync(new URL("../core/voice/v4/gateway.js", import.meta.url), "utf8");

test("voice race fence: native callbacks carry session ids for JS-side validation", () => {
  assert.match(native, /nativeVoiceSessionGeneration/);
  assert.match(native, /activeNativeVoiceSessionId/);
  assert.match(native, /activeNativeVoiceSessionId = \+\+nativeVoiceSessionGeneration/);
  assert.match(native, /sessionId:\$sessionId/);
  assert.match(interaction, /acceptNativeCaptureEvent\(event/);
  assert.match(interaction, /sessionId === this\.captureSessionId/);
});

test("voice race fence: stale native results cannot cross an invalidated capture", () => {
  assert.match(interaction, /this\.captureSessionId = null;/);
  assert.match(interaction, /if \(!this\.acceptNativeCaptureEvent\(event\)\) return;/);
  assert.match(interaction, /this\.captureSessionId = null;\n      this\.reportInput\(text, \"native\"\)/);
});

test("voice race fence: interruption invalidates the old capture turn before handoff", () => {
  const interruptionIndex = interaction.indexOf("handleInterruption(capture, decision)");
  assert.ok(interruptionIndex >= 0);
  const interruptionBody = interaction.slice(interruptionIndex, interaction.indexOf("\n  acceptResult()", interruptionIndex));
  assert.match(interruptionBody, /const interruptedTurn = this\.turn/);
  assert.match(interruptionBody, /this\.turn = this\.interruption\.beginTurn\(\)/);
  assert.match(interruptionBody, /this\.speaking = false/);
  assert.match(interruptionBody, /this\.captureSessionId = null/);
  assert.match(interruptionBody, /this\.v3CaptureSessionId = null/);
  assert.match(interruptionBody, /requestV3Stop\("voice-interrupt"\)/);
  assert.match(interruptionBody, /requestVoiceOutputStop\("voice-interrupt"\)/);
  assert.doesNotMatch(interruptionBody, /[^A-Za-z]stopSpeaking\(\)/);
  assert.match(interruptionBody, /queueMicrotask\(\(\) =>/);
  assert.match(interruptionBody, /this\.interruption\.isCurrent\(this\.turn\)/);
  assert.match(interruptionBody, /previousTurn: interruptedTurn/);
  assert.match(interruptionBody, /sourceInput: capture\.text/);
  assert.match(gateway, /registerVoiceOutputStopHandler/);
  assert.match(gateway, /requestVoiceOutputStop/);
});

test("voice race fence: interrupted TTS cannot finish the replacement turn", () => {
  const speakingIndex = interaction.indexOf("async beginSpeaking(text)");
  const speakingBody = interaction.slice(speakingIndex);
  assert.match(speakingBody, /const speakingTurn = this\.turn/);
  assert.match(speakingBody, /if \(this\.turn !== speakingTurn\)/);

  assert.match(bridge, /let speechGeneration = 0/);
  assert.match(bridge, /const interruptedGeneration = \+\+speechGeneration/);
  assert.match(bridge, /const generation = \+\+speechGeneration/);
  assert.match(bridge, /generation !== speechGeneration/);
});

test("voice race fence: native stale TTS completion is explicitly suppressed after stop", () => {
  assert.match(bridge, /ignoredNativeCompletion = true/);
  assert.match(bridge, /ignoredNativeCompletionTimer/);
  assert.match(bridge, /if \(ignoredNativeCompletion\)/);
  assert.match(bridge, /window\.removeEventListener\("haiva:native-speech-done", finish\)/);
});

test("voice race fence: V3 remains internal to Voice Interaction", () => {
  const app = readFileSync(new URL("../core/app.js", import.meta.url), "utf8");
  assert.match(interaction, /createVoiceInteractionV3/);
  assert.doesNotMatch(app, /createVoiceInteractionV3/);
  assert.doesNotMatch(app, /haiva:native-voice-/);
  assert.doesNotMatch(app, /v1Capture/);
});
