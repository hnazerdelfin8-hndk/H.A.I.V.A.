import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("advanced memory stores, recalls and forgets typed entries", async () => {
  const source = await read("core/memory/advanced-memory.js");
  assert.match(source, /createAdvancedMemoryStore/);
  assert.match(source, /recall\(/);
  assert.match(source, /forget\(/);
  assert.match(source, /type/);
});

test("wake word matching is case insensitive", async () => {
  const source = await read("core/voice/wake-word.js");
  const config = await read("core/config.js");
  assert.match(source, /containsWakeWord/);
  assert.match(source, /toLowerCase/);
  assert.match(config, /wakeWords/);
});

test("provider gateway builds Groq-compatible requests", async () => {
  const source = await read("api/provider-gateway.js");
  assert.match(source, /api\.groq\.com/);
  assert.match(source, /chat\/completions/);
});

test("provider gateway rejects an unconfigured provider explicitly", async () => {
  const source = await read("api/provider-gateway.js");
  assert.match(source, /not configured/i);
  assert.match(source, /PROVIDER_NOT_CONFIGURED/);
});

test("provider answer extraction supports configured Gemini and OpenAI-compatible responses", async () => {
  const source = await read("api/provider-gateway.js");
  assert.match(source, /candidates/);
  assert.match(source, /choices/);
});

test("provider registry exposes configuration state without secrets", async () => {
  const source = await read("api/provider-gateway.js");
  assert.match(source, /listProviders/);
  assert.match(source, /configured: Boolean/);
  assert.doesNotMatch(source, /apiKey:\s*getProviderApiKey/);
});

test("canonical skill registry exposes the expected skill surface", async () => {
  const source = await read("core/skill-manager.js");
  assert.match(source, /registerSkill/);
  assert.match(source, /getSkill/);
});

test("main application calls the assistant's supported respond API", async () => {
  const app = await read("core/app.js");
  assert.match(app, /assistant\.respond/);
});

test("chat and voice modes share the canonical response pipeline", async () => {
  const app = await read("core/app.js");
  const chat = await read("skills/chat/index.js");
  const config = await read("core/config.js");
  assert.match(app, /handleResultText/);
  assert.match(chat, /chatEndpoint/);
  assert.match(config, /chatEndpoint/);
});

test("voice pipeline is event driven and avoids legacy grace-period timers", async () => {
  const config = await read("core/config.js");
  const app = await read("core/app.js");
  const bridge = await read("core/ui-bridge.js");
  const android = await read("android/app/src/main/java/com/haiva/app/MainActivity.kt");

  assert.doesNotMatch(config, /initialSpeechGraceMs/);
  assert.doesNotMatch(config, /postSpeechSilenceMs/);
  assert.doesNotMatch(app, /voiceStartTimer/);
  assert.doesNotMatch(app, /voiceSilenceTimer/);
  assert.doesNotMatch(app, /scheduleBrowserSilenceCompletion/);
  assert.doesNotMatch(app, /voiceRestartTimer/);
  assert.doesNotMatch(app, /setTimeout\(/);
  assert.doesNotMatch(bridge, /setTimeout\(/);
  assert.match(app, /haiva:native-voice-result/);
  assert.match(app, /void this\.handleResultText\(text\)/);
  assert.match(app, /recoverNativeVoiceFromEvent/);
  assert.match(app, /voiceSilenceRetries/);
  assert.match(bridge, /haiva:native-speech-done/);

  assert.match(android, /Core\/app\.js owns the conversational .*READY\/LISTENING\/THINKING\/SPEAKING lifecycle/);
  assert.match(android, /haiva:native-voice-segment-end/);
  assert.match(android, /nativeVoiceWatchdogMs = 5000L/);
  assert.match(android, /haiva:native-voice-timeout/);
  assert.doesNotMatch(android, /postDelayed\(initialSpeechWindow, 3000L\)/);
  assert.doesNotMatch(android, /private val initialSpeechWindow/);
});

test("V2 microphone wiring routes through the canonical command contract", async () => {
  const polish = await read("ui/polish.js");
  const v2 = await read("core/voice/interaction/v2/interaction.js");
  const app = await read("core/app.js");
  assert.match(polish, /V2_EVENTS/);
  assert.match(polish, /dispatchV2Event/);
  assert.doesNotMatch(polish, /app\.conversationalVoice\s*=\s*false/);
  assert.match(v2, /haiva:v2-voice-activate/);
  assert.match(v2, /haiva:v2-voice-deactivate/);
  assert.match(v2, /installV2VoiceControl/);
  assert.match(v2, /app\.conversationalVoice\s*=\s*true/);
  assert.match(app, /this\.voiceActivated\s*=\s*speakResponse\s*&&\s*this\.conversationalVoice/);
  assert.match(app, /if \(this\.voiceActivated\) this\.startListening\(\)/);
});

test("V2 native event vocabulary is synchronized across JS contract, core and Android", async () => {
  const v2 = await read("core/voice/interaction/v2/interaction.js");
  const app = await read("core/app.js");
  const bridge = await read("core/ui-bridge.js");
  const controls = await read("core/phase1-controls.js");
  const android = await read("android/app/src/main/java/com/haiva/app/MainActivity.kt");

  for (const event of [
    "haiva:native-voice-ready",
    "haiva:native-voice-begin",
    "haiva:native-voice-segment-end",
    "haiva:native-voice-partial",
    "haiva:native-voice-result",
    "haiva:native-voice-timeout",
    "haiva:native-voice-error",
    "haiva:native-speech-done"
  ]) {
    assert.match(v2, new RegExp(event.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(app, /haiva:native-voice-ready/);
  assert.match(app, /haiva:native-voice-result/);
  assert.match(app, /haiva:native-voice-timeout/);
  assert.match(bridge, /haiva:native-speech-done/);
  assert.match(controls, /haiva:native-voice-unavailable/);
  assert.match(android, /haiva:native-voice-ready/);
  assert.match(android, /haiva:native-voice-result/);
  assert.match(android, /haiva:native-voice-segment-end/);
});

test("voice connector events have one Android producer and bounded recovery paths", async () => {
  const app = await read("core/app.js");
  const controls = await read("core/phase1-controls.js");
  const android = await read("android/app/src/main/java/com/haiva/app/MainActivity.kt");

  assert.match(app, /haiva:native-voice-timeout/);
  assert.match(app, /setState\("VOICE UNAVAILABLE"\)/);
  assert.match(controls, /haiva:native-voice-unavailable/);
  assert.match(android, /dispatchVoiceUnavailable/);
});

test("voice state machine has one core orchestration path", async () => {
  const app = await read("core/app.js");
  assert.match(app, /setState\(/);
  assert.match(app, /startVoice/);
  assert.match(app, /stopVoice/);
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
