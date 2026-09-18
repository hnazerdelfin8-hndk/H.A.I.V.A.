import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const app = readFileSync(new URL("../core/app.js", import.meta.url), "utf8");
const interaction = readFileSync(new URL("../core/voice/interaction.js", import.meta.url), "utf8");
const handoff = readFileSync(new URL("../core/voice/capture-handoff.js", import.meta.url), "utf8");
const v1 = readFileSync(new URL("../core/voice/v1-capture-controller.js", import.meta.url), "utf8");
const v2 = readFileSync(new URL("../core/voice/lifecycle-coordinator.js", import.meta.url), "utf8");
const v3Logic = readFileSync(new URL("../core/voice/v3-interaction.js", import.meta.url), "utf8");
const v3Capture = readFileSync(new URL("../core/voice/v3-capture-controller.js", import.meta.url), "utf8");
const v4 = readFileSync(new URL("../core/voice/gateway.js", import.meta.url), "utf8");
const duplex = readFileSync(new URL("../core/voice/duplex-audio-controller.js", import.meta.url), "utf8");
const brain = readFileSync(new URL("../core/brain/decision.js", import.meta.url), "utf8");
const androidBridge = readFileSync(new URL("../android/app/src/main/java/com/haiva/bridge/HaivaBridge.kt", import.meta.url), "utf8");
const androidActivity = readFileSync(new URL("../android/app/src/main/java/com/haiva/app/MainActivity.kt", import.meta.url), "utf8");

test("voice boundary: VoiceInteraction owns the voice domain", () => {
  assert.match(app, /import \{ VoiceInteraction \} from "\.\/voice\/interaction\.js"/);
  assert.match(app, /new VoiceInteraction\(/);
  assert.doesNotMatch(app, /createVoiceInteraction\s*\(/);
  assert.match(interaction, /v1Capture/);
  assert.match(interaction, /v3Capture/);
  assert.match(interaction, /VoiceLifecycleV2/);
  assert.match(interaction, /createVoiceInteractionV3/);
  assert.doesNotMatch(app, /v1Capture|v3Capture|VoiceLifecycleV2|SpeechRecognition/);
});

test("voice boundary: Brain remains semantic decision authority", () => {
  assert.match(brain, /decideVoiceControl/);
  assert.match(interaction, /onBrainDecision/);
  assert.match(interaction, /handleV3InterruptCandidate/);
  assert.doesNotMatch(v3Logic, /INTERRUPTION_PATTERNS|END_CONVERSATION_PATTERNS/);
});

test("voice boundary: V1 is normal-input capture only", () => {
  assert.match(v1, /startVoiceCapture/);
  assert.match(v1, /stopVoiceCapture/);
  assert.match(v1, /handoffToV1/);
  assert.match(v1, /releaseFromV1/);
  assert.doesNotMatch(v1, /startV3VoiceCapture|stopV3VoiceCapture|handoffToV3|v3Capture/);
});

test("voice boundary: V2 is lifecycle-only", () => {
  assert.match(v2, /VoiceLifecycleV2/);
  assert.match(v2, /activateListening/);
  assert.match(v2, /beginThinking/);
  assert.match(v2, /beginSpeaking/);
  assert.match(v2, /interruptToThinking/);
  assert.doesNotMatch(v2, /SpeechRecognition|startVoiceCapture|startV3VoiceCapture|decideVoiceControl/);
});

test("voice boundary: V3 owns interruption state and routes through V4", () => {
  assert.match(v3Logic, /beginMonitoring/);
  assert.match(v3Logic, /commitCapture/);
  assert.match(v3Logic, /ARMED/);
  assert.match(v3Logic, /does NOT open a second SpeechRecognizer/);
  assert.match(v3Capture, /handoffToV3/);
  assert.match(v3Capture, /releaseFromV3/);
  assert.match(v3Capture, /routeV3InterruptCandidate/);
  assert.match(v3Capture, /haiva:v3-interrupt-signal/);
  assert.match(v3Capture, /DuplexAudioController/);
  assert.match(v3Capture, /startInterruptMonitor/);
  assert.match(v3Capture, /startRecognitionAfterDuplex/);
  assert.doesNotMatch(v3Capture, /new SpeechRecognizer|SpeechRecognition/);
});

test("voice boundary: duplex monitor detects onset before V3 starts full STT", () => {
  assert.match(duplex, /startDuplexInterruptMonitor/);
  assert.match(duplex, /stopDuplexInterruptMonitor/);
  assert.match(duplex, /haiva:duplex-interrupt-detected/);
  assert.doesNotMatch(duplex, /SpeechRecognition|startV3VoiceCapture/);
  assert.match(interaction, /haiva:v3-duplex-speech-start/);
  assert.match(interaction, /requestVoiceOutputStop\("duplex-speech-start"\)/);
  assert.match(interaction, /v3Capture\.startRecognitionAfterDuplex\(\)/);
});

test("voice boundary: V4 carries capture and interrupt control without owning a recognizer", () => {
  assert.match(v4, /handoffToV1/);
  assert.match(v4, /handoffToV3/);
  assert.match(v4, /releaseFromV1/);
  assert.match(v4, /releaseFromV3/);
  assert.match(v4, /registerVoiceInterruptHandler/);
  assert.match(v4, /routeV3InterruptCandidate/);
  assert.match(v4, /requestV3Stop/);
  assert.match(v4, /requestVoiceOutputStop/);
  assert.doesNotMatch(v4, /SpeechRecognition|startVoiceCapture|startV3VoiceCapture|decideVoiceControl|setTimeout/);
});

test("voice boundary: confirmed V3 interrupt returns through V4 for V3 stop and TTS stop", () => {
  assert.match(interaction, /registerVoiceInterruptHandler/);
  assert.match(interaction, /requestV3Stop\("voice-interrupt"\)/);
  assert.match(interaction, /requestVoiceOutputStop\("voice-interrupt"\)/);
  assert.match(interaction, /this\.onBrainDecision/);
});

test("voice boundary: V1 and V3 use one exclusive physical capture route", () => {
  assert.match(handoff, /registerCaptureOwner/);
  assert.match(handoff, /acquireCapture/);
  assert.match(handoff, /releaseCapture/);
  assert.doesNotMatch(handoff, /HANDOFF_DELAY_MS|setTimeout|pendingTimer/);
  assert.match(androidBridge, /startV3VoiceCapture\(\)/);
  assert.match(androidBridge, /stopV3VoiceCapture\(\)/);
  assert.match(androidActivity, /speechRecognizer: SpeechRecognizer\?/);
  assert.doesNotMatch(androidActivity, /v3SpeechRecognizer: SpeechRecognizer\?/);
  assert.match(androidActivity, /NativeCaptureMode\.INTERRUPT/);
});

test("voice boundary: speaking loop uses duplex onset then the same native recognizer as V3", () => {
  assert.match(interaction, /this\.lifecycle\.beginSpeaking\(\);[\s\S]*this\.interruption\.beginMonitoring\(speakingTurn\)/);
  assert.match(interaction, /v3Capture\.startRecognitionAfterDuplex\(\)/);
  assert.match(v3Capture, /handoffToV3/);
  assert.match(interaction, /this\.interruption\.stopMonitoring\(speakingTurn\)/);
  assert.match(interaction, /v3Capture\.stopCapture\(\)/);
  assert.match(interaction, /this\.startListening\(\)/);
  assert.doesNotMatch(interaction, /native-speech-start.*v3Capture/s);
});
