import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const app = readFileSync(new URL("../core/app.js", import.meta.url), "utf8");
const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");
const v2 = readFileSync(new URL("../core/voice/lifecycle-coordinator.js", import.meta.url), "utf8");
const bargeIn = readFileSync(new URL("../core/voice/barge-in.js", import.meta.url), "utf8");
const v4 = readFileSync(new URL("../core/voice/gateway.js", import.meta.url), "utf8");
const duplex = readFileSync(new URL("../core/voice/duplex/controller.js", import.meta.url), "utf8");
const brain = readFileSync(new URL("../core/brain/decision.js", import.meta.url), "utf8");

test("voice boundary: VoiceInteraction owns the voice domain", () => {
  assert.match(app, /import \{ VoiceInteraction \} from "\.\/voice\/interaction\.js"/);
  assert.match(app, /new VoiceInteraction\(/);
  assert.doesNotMatch(app, /createVoiceInteraction\s*\(/);
  assert.doesNotMatch(interaction, /v1Capture|v3Capture|handoffToV[13]/);
  assert.match(interaction, /VoiceLifecycleV2/);
  assert.match(interaction, /createBargeInCoordinator/);
  assert.match(interaction, /new DuplexController/);
  assert.doesNotMatch(app, /v1Capture|v3Capture|VoiceLifecycleV2|SpeechRecognition/);
});

test("voice boundary: Brain remains semantic decision authority", () => {
  assert.match(brain, /decideVoiceControl/);
  assert.match(interaction, /onBrainDecision/);
  assert.match(interaction, /handleBargeInCandidate/);
  assert.doesNotMatch(bargeIn, /INTERRUPTION_PATTERNS|END_CONVERSATION_PATTERNS/);
});

test("voice boundary: V2 is lifecycle-only", () => {
  assert.match(v2, /VoiceLifecycleV2/);
  assert.match(v2, /activateListening/);
  assert.match(v2, /beginThinking/);
  assert.match(v2, /beginSpeaking/);
  assert.match(v2, /interruptToThinking/);
  assert.doesNotMatch(v2, /SpeechRecognition|startVoiceCapture|startV3VoiceCapture|decideVoiceControl/);
});

test("voice boundary: Barge-in owns interruption state without a capture controller", () => {
  assert.match(bargeIn, /beginMonitoring/);
  assert.match(bargeIn, /commitCapture/);
  assert.match(bargeIn, /ARMED/);
  assert.match(bargeIn, /beginTurn/);
});

test("voice boundary: canonical duplex controller is the physical audio boundary", () => {
  assert.match(duplex, /start\(turn\)/);
  assert.match(duplex, /startDuplexAudio/);
  assert.match(duplex, /stopDuplexAudio/);
  assert.match(interaction, /this\.duplex\.start\(speakingTurn\)/);
});

test("voice boundary: V4 no longer owns capture workers", () => {
  assert.doesNotMatch(v4, /handoffToV1|handoffToV3|releaseFromV1|releaseFromV3/);
  assert.doesNotMatch(v4, /startVoiceCapture|startV3VoiceCapture|SpeechRecognition|SpeechRecognizer/);
});
