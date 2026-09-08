import test from "node:test";
import assert from "node:assert/strict";

import { createAdvancedMemoryStore } from "../core/memory/advanced-memory.js";
import { containsWakeWord } from "../core/voice/wake-word.js";
import { orchestrate } from "../core/orchestrator/index.js";
import { buildProviderRequest, extractProviderAnswer, listProviders } from "../api/provider-gateway.js";
import { getCanonicalSkills } from "../skills/registry.js";
import { readFile } from "node:fs/promises";

test("advanced memory stores, recalls and forgets typed entries", () => {
  const store = createAdvancedMemoryStore([], { maxEntries: 10 });
  const entry = store.remember({ type: "conversation", content: "user: hello Master", metadata: { role: "user" } });
  assert.equal(store.size(), 1);
  assert.equal(store.recall({ type: "conversation", query: "hello" })[0].id, entry.id);
  assert.equal(store.forget(entry.id), true);
  assert.equal(store.size(), 0);
});

test("wake word matching is case insensitive", () => {
  assert.equal(containsWakeWord("YO HAIVA, are you there?", ["yo haiva"]), true);
  assert.equal(containsWakeWord("hello there", ["yo haiva"]), false);
});

test("provider gateway builds Groq-compatible requests", () => {
  const request = buildProviderRequest("groq", [{ role: "user", content: "hello" }], {}, { GROQ_API_KEY: "test-key" });
  assert.equal(request.provider.id, "groq");
  assert.equal(request.headers.Authorization, "Bearer test-key");
  assert.match(request.url, /api\.groq\.com/);
  assert.equal(JSON.parse(request.body).messages[0].content, "hello");
});

test("provider gateway rejects an unconfigured provider explicitly", () => {
  assert.throws(
    () => buildProviderRequest("openai", [{ role: "user", content: "hello" }], {}, {}),
    error => error.code === "PROVIDER_NOT_CONFIGURED"
  );
});

test("provider answer extraction supports configured Gemini and OpenAI-compatible responses", () => {
  assert.equal(extractProviderAnswer("gemini", { candidates: [{ content: { parts: [{ text: "hello" }] } }] }), "hello");
  assert.equal(extractProviderAnswer("groq", { choices: [{ message: { content: "hello" } }] }), "hello");
});

test("provider registry exposes configuration state without secrets", () => {
  const providers = listProviders({ GROQ_API_KEY: "x" });
  assert.equal(providers.find(provider => provider.id === "groq")?.configured, true);
  assert.equal(Object.keys(providers[0]).includes("apiKey"), false);
});

test("canonical skill registry exposes the expected skill surface", () => {
  assert.deepEqual(getCanonicalSkills().sort(), ["music", "notes", "reminder", "weather", "web_search"].sort());
});

test("main application calls the assistant's supported respond API", async () => {
  const source = await readFile(new URL("../core/app.js", import.meta.url), "utf8");
  assert.match(source, /this\.assistant\.respond\(command\)/);
  assert.doesNotMatch(source, /this\.assistant\.process\(command\)/);
});

test("chat and voice modes share the canonical response pipeline", async () => {
  const source = await readFile(new URL("../core/app.js", import.meta.url), "utf8");
  const chatHandler = source.match(/async handleTextCommand\(command, speakResponse = false\) \{[\s\S]*?\n  \}/)?.[0] || "";
  const resultHandler = source.match(/async handleResultText\(text\) \{[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(chatHandler, /await this\.assistant\.respond\(command\)/);
  assert.doesNotMatch(chatHandler, /await speak\(answer\)/);
  assert.match(resultHandler, /removeWakeWord\(text\)/);
  assert.match(resultHandler, /await this\.handleTextCommand\(command, true\)/);
  assert.doesNotMatch(resultHandler, /this\.assistant\.respond\(command\)/);
});

test("voice pipeline is event driven and avoids legacy grace-period timers", async () => {
  const config = await readFile(new URL("../core/config.js", import.meta.url), "utf8");
  const app = await readFile(new URL("../core/app.js", import.meta.url), "utf8");
  const android = await readFile(new URL("../android/app/src/main/java/com/haiva/app/MainActivity.kt", import.meta.url), "utf8");

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

  assert.match(android, /Core\/app\.js is the single owner/);
  assert.match(android, /haiva:native-voice-end/);
  assert.match(android, /nativeVoiceWatchdogMs = 5000L/);
  assert.match(android, /haiva:native-voice-timeout/);
  assert.doesNotMatch(android, /postDelayed\(initialSpeechWindow, 3000L\)/);
  assert.doesNotMatch(android, /private val initialSpeechWindow/);
});

test("voice connector events have one Android producer and bounded recovery paths", async () => {
  const app = await readFile(new URL("../core/app.js", import.meta.url), "utf8");
  const controls = await readFile(new URL("../core/phase1-controls.js", import.meta.url), "utf8");
  const android = await readFile(new URL("../android/app/src/main/java/com/haiva/app/MainActivity.kt", import.meta.url), "utf8");

  assert.match(app, /haiva:native-voice-timeout/);
  assert.match(app, /setState\("VOICE UNAVAILABLE"\)/);
  assert.match(controls, /haiva:native-voice-unavailable/);
  assert.match(controls, /app\.deactivateVoice/);
  assert.match(android, /haiva:native-voice-timeout/);
  assert.match(android, /haiva:native-voice-unavailable/);
  assert.match(android, /cancelNativeVoiceWatchdog\(\)/);
});

test("voice state machine has one core orchestration path", async () => {
  const source = await readFile(new URL("../core/app.js", import.meta.url), "utf8");
  assert.match(source, /this\.setState\("LISTENING"\)/);
  assert.match(source, /this\.setState\("THINKING"\)/);
  assert.match(source, /this\.setState\("READY"\)/);
  assert.match(source, /async handleResultText\(text\)/);
  assert.match(source, /await this\.handleTextCommand\(command, true\)/);
  assert.doesNotMatch(source, /async handleCommand\(command\)/);
  assert.doesNotMatch(source, /recognition\.start\(\).*recognition\.start\(/s);
});

test("AI orchestration has a bounded remote request and no retry storm", async () => {
  const source = await readFile(new URL("../core/orchestrator/index.js", import.meta.url), "utf8");
  assert.match(source, /const DEFAULT_MAX_RETRIES = 0/);
  assert.match(source, /const AI_REQUEST_TIMEOUT_MS = 8000/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /signal: controller\.signal/);
});

test("orchestrator executes through the configured chat gateway", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() { return { response: "Orchestrator test response" }; }
    };
  };

  try {
    const result = await orchestrate({
      message: "research the best workflow",
      context: [],
      intent: { name: "research" },
      reasoning: {},
      decision: {}
    });

    assert.equal(result.success, true);
    assert.equal(result.source, "orchestrator");
    assert.equal(result.orchestration.agent, "tool-aware-general-agent");
    assert.equal(result.orchestration.tool, "api-tools");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
  }
});