import assert from "node:assert/strict";
import { createAdvancedMemoryStore, importAdvancedMemory, createMemoryAdapter } from "../../core/memory/advanced-memory.js";

// Stage 5A — architecture and memory scopes
const memory = createAdvancedMemoryStore();
const preference = memory.remember({ type: "preference", content: "H.A.I.V.A. should call me Master", importance: 0.9, confidence: 0.95, source: "user" });
assert.equal(preference.type, "preference");
assert.equal(preference.source, "user");

// Stage 5B — persistence/export/import
memory.remember({ type: "fact", content: "HAIVA uses a sequential verification chain", confidence: 0.9 });
const restored = importAdvancedMemory(memory.export());
assert.equal(restored.size(), 2);
assert.equal(restored.recall({ query: "sequential verification" })[0].content, "HAIVA uses a sequential verification chain");

// Stage 5C — intelligent retrieval/ranking
restored.remember({ type: "project", content: "Advanced memory retrieval for HAIVA", importance: 1, confidence: 0.9 });
restored.remember({ type: "project", content: "Unrelated gardening note", importance: 1, confidence: 0.9 });
const retrieval = restored.recall({ query: "HAIVA memory retrieval", limit: 2 });
assert.equal(retrieval[0].content, "Advanced memory retrieval for HAIVA");
assert.ok(retrieval[0].relevance > retrieval[1].relevance);

// Stage 5D — deduplication/consolidation
const before = restored.size();
restored.remember({ type: "project", content: "Advanced memory retrieval for HAIVA", confidence: 1, metadata: { consolidated: true } });
assert.equal(restored.size(), before);
assert.equal(restored.recall({ query: "advanced memory retrieval" })[0].confidence, 1);
const consolidated = restored.consolidate();
assert.equal(consolidated.length, restored.size());

// Stage 5E — trust/lifecycle
const expiring = restored.remember({ type: "fact", content: "Temporary fact", expiresAt: new Date(Date.now() - 1000).toISOString() });
assert.equal(restored.recall({ query: "Temporary fact" }).length, 0);
assert.equal(restored.recall({ query: "Temporary fact", includeExpired: true })[0].id, expiring.id);
assert.equal(restored.forgetExpired(), 1);

// Stage 5F — agent/task memory
const task = restored.rememberTask("Finish Stage 5 verification", { phase: "5F", source: "agent", confidence: 0.9 });
assert.equal(task.type, "task");
assert.equal(task.metadata.memoryScope, "task");
assert.equal(restored.recall({ type: "task", query: "Stage 5" })[0].id, task.id);

// Stage 5G — voice-compatible memory adapter
const adapter = createMemoryAdapter(restored);
adapter.remember("user", "Remember that my next task is Stage 5 verification.");
const context = adapter.getContext();
assert.equal(context.at(-1).role, "user");
assert.match(context.at(-1).content, /next task/i);

// Stage 5H — hardening/bounds/invalid input behavior
const bounded = createAdvancedMemoryStore([], { maxEntries: 2 });
bounded.remember({ type: "fact", content: "one" });
bounded.remember({ type: "fact", content: "two" });
bounded.remember({ type: "fact", content: "three" });
assert.equal(bounded.size(), 2);
assert.throws(() => bounded.remember({ type: "fact", content: "" }), /required/);
assert.equal(importAdvancedMemory("not-json").size(), 0);
assert.equal(bounded.forget("missing-id"), false);

console.log("PASS: HAIVA Stage 5A-5H Advanced Memory tests");
