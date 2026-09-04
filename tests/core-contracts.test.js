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

test("provider answer extraction supports Gemini and Anthropic", () => {
  assert.equal(extractProviderAnswer("gemini", { candidates: [{ content: { parts: [{ text: "hello" }] } }] }), "hello");
  assert.equal(extractProviderAnswer("anthropic", { content: [{ type: "text", text: "hello" }] }), "hello");
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
