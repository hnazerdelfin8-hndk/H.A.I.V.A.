import test from "node:test";
import assert from "node:assert/strict";

import { createAdvancedMemoryStore } from "../core/memory/advanced-memory.js";
import { containsWakeWord } from "../core/voice/wake-word.js";
import { orchestrate } from "../core/orchestrator/index.js";

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
