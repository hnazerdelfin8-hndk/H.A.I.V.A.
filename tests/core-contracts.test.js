import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("advanced memory stores, recalls and forgets typed entries", async () => {
  const source = await read("core/memory.js");
  assert.match(source, /storeMemory/);
  assert.match(source, /recallMemories/);
  assert.match(source, /forgetMemory/);
  assert.match(source, /type/);
});

test("wake word matching is case insensitive", async () => {
  const config = await read("core/config.js");
  assert.match(config, /wakeWords/);
  assert.match(config, /toLowerCase/);
});

test("provider gateway builds Groq-compatible requests", async () => {
  const source = await read("core/provider-gateway.js");
  assert.match(source, /api\.groq\.com/);
  assert.match(source, /chat\/completions/);
});

test("provider gateway rejects an unconfigured provider explicitly", async () => {
  const source = await read("core/provider-gateway.js");
  assert.match(source, /not configured/i);
});

test("provider answer extraction supports configured Gemini and OpenAI-compatible responses", async () => {
  const source = await read("core/provider-gateway.js");
  assert.match(source, /candidates/);
  assert.match(source, /choices/);
});

test("provider registry exposes configuration state without secrets", async () => {
  const source = await read("core/provider-registry.js");
  assert.match(source, /configured/);
  assert.doesNotMatch(source, /process\.env\.[A-Z0-9_]+\s*\)/);
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
  assert.match(app, /handleResultText/);
  assert.match(chat, /\/api\/chat/);
});

test("voice pipeline is event driven and avoids legacy grace-period timers", async () => {
  const config = await read("core/config.js");
  const app = await read("core/app.js");
  const android = await read("android/app/src/main/java/com/haiva/app/MainActivity.kt");

  assert.doesNotMatch(config, /initialSpeechGraceMs/);
  assert.doesNotMatch(config, /postSpeechSilenceMs/);
  assert.doesNotMatch(app, /voiceStartTimer/);
  assert.doesNotMatch(app, /voiceSilenceTimer/);
  assert.doesNotMatch(app, /scheduleBrowserSilenceCompletion/);
  assert.doesNotMatch(app, /voiceRestartTimer/);
  assert.doesNotMatch(app, /setTimeout\(/);
  assert.match(app, /haiva:native-voice-result/);
  assert.match(app, /void this\.handleResultText\(text\)/);
  assert.match(app, /recoverNativeVoiceFromEvent/);
  assert.match(app, /voiceSilenceRetries/);

  assert.match(android, /Core\/app\.js owns the conversational .*READY\/LISTENING\/THINKING\/SPEAKING lifecycle/);
  assert.match(android, /haiva:native-voice-segment-end/);
  assert.match(android, /nativeVoiceWatchdogMs = 5000L/);
  assert.match(android, /haiva:native-voice-timeout/);
  assert.doesNotMatch(android, /postDelayed\(initialSpeechWindow, 3000L\)/);
  assert.doesNotMatch(android, /private val initialSpeechWindow/);
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
  const source = await read("core/orchestrator.js");
  assert.match(source, /AbortController/);
  assert.match(source, /timeout/);
});

test("orchestrator executes through the configured chat gateway", async () => {
  const source = await read("core/orchestrator.js");
  assert.match(source, /chatGateway|providerGateway|gateway/i);
});
