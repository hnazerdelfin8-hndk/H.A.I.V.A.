import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = async path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("voice connector events have one Android producer and bounded recovery paths", async () => {
  const app = await read("core/app.js");
  const controls = await read("core/phase1-controls.js");
  const android = await read("android/app/src/main/java/com/haiva/app/MainActivity.kt");

  assert.doesNotMatch(app, /haiva:native-voice-timeout/);
  assert.match(app, /setState\("READY"\)/);
  assert.match(controls, /haiva:native-voice-unavailable/);
  assert.match(android, /dispatchVoiceUnavailable/);
});

test("Core App connects to Voice Interaction only", async () => {
  const app = await read("core/app.js");
  const interaction = await read("core/voice/interaction/index.js");
  const captureAdapter = await read("core/voice/capture/factory.js");

  assert.match(app, /import \{ VoiceInteraction \} from "\.\/voice\/interaction\.js"/);
  assert.match(app, /new VoiceInteraction\(/);
  assert.doesNotMatch(app, /createVoiceInteraction\s*\(/);
  assert.doesNotMatch(app, /createSpeechRecognition/);
  assert.doesNotMatch(app, /v1Capture|v3Capture/);
  assert.doesNotMatch(app, /VoiceLifecycleV2/);
  assert.doesNotMatch(app, /haiva:native-voice-/);
  assert.doesNotMatch(interaction, /v1Capture|v3Capture/);
  assert.match(interaction, /VoiceLifecycleV2/);
  assert.match(interaction, /createBargeInCoordinator/);
});

test("Voice Interaction uses canonical Duplex ownership", async () => {
  const interaction = await read("core/voice/interaction/index.js");
  const captureAdapter = await read("core/voice/capture/factory.js");
  assert.match(interaction, /new DuplexController/);
  assert.match(interaction, /this\.duplex\.start\(speakingTurn\)/);
  assert.match(captureAdapter, /NativeCaptureAdapter/);
  assert.match(interaction, /this\.capture\.start\(\)/);
  assert.doesNotMatch(interaction, /handoffToV[13]|startV3VoiceCapture/);
});

test("AI orchestration has a bounded remote request and no retry storm", async () => {
  const source = await read("core/orchestrator/index.js");
  assert.match(source, /AbortController/);
  assert.match(source, /AI_REQUEST_TIMEOUT_MS/);
  assert.match(source, /DEFAULT_MAX_RETRIES = 0/);
});

test("orchestrator executes through the configured chat gateway", async () => {
  const source = await read("core/orchestrator/index.js");
  assert.match(source, /CONFIG\.api\.chatEndpoint/);
  assert.match(source, /fetch\(CONFIG\.api\.chatEndpoint/);
});

test("UI exposes lifecycle states only; internal failures recover to standby", async () => {
  const app = await read("core/app.js");
  const bridge = await read("core/ui-bridge.js");
  const orb = await read("core/haiva-orb.js");
  const polish = await read("ui/polish.js");

  assert.doesNotMatch(app, /setState\("(?:ERROR|VOICE ERROR|VOICE UNAVAILABLE|MICROPHONE DENIED)"\)/);
  assert.doesNotMatch(app, /state === "(?:ERROR|VOICE ERROR|VOICE UNAVAILABLE|MICROPHONE DENIED)"/);
  assert.doesNotMatch(orb, /"ERROR"|"VOICE ERROR"|"VOICE UNAVAILABLE"|"MICROPHONE DENIED"/);
  assert.match(bridge, /normalized === "ready" \? "STANDBY"/);
  assert.doesNotMatch(polish, /setState\("VOICE ERROR"\)/);
  assert.doesNotMatch(polish, /data-haiva-state="error"/);
});

test("voice UI control is event-driven and does not own VoiceInteraction", async () => {
  const app = await read("core/app.js");
  const polish = await read("ui/polish.js");
  assert.match(app, /setupVoiceEvents\(\)/);
  assert.match(app, /addEventListener\("haiva:voice-toggle"/);
  assert.match(polish, /dispatchEvent\(new CustomEvent\("haiva:voice-toggle"/);
  assert.doesNotMatch(polish, /window\.HAIVA.*activateVoice|window\.HAIVA.*deactivateVoice/);
});

test("obsolete visual boot loader is removed", async () => {
  const index = await read("index.html");
  assert.doesNotMatch(index, /haiva-boot-screen|boot-loader\.js/);
  assert.match(index, /<script type="module" src="\.\/core\/boot\.js"><\/script>/);
});
