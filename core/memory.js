// =========================================
// H.A.I.V.A. CANONICAL MEMORY ADAPTER
// =========================================
// Browser-persistent facade over the advanced memory engine.

import { createAdvancedMemoryStore, importAdvancedMemory } from "./memory/advanced-memory.js";

const STORAGE_KEY = "haiva_memory_v2";
const MAX_MESSAGES = 50;
const CONTEXT_MESSAGES = 24;

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? importAdvancedMemory(raw, { maxEntries: MAX_MESSAGES })
      : createAdvancedMemoryStore([], { maxEntries: MAX_MESSAGES });
  } catch (error) {
    console.warn("H.A.I.V.A. memory load failed:", error);
    return createAdvancedMemoryStore([], { maxEntries: MAX_MESSAGES });
  }
}

function persist(store) {
  try {
    localStorage.setItem(STORAGE_KEY, store.export());
  } catch (error) {
    console.warn("H.A.I.V.A. memory save failed:", error);
  }
}

function toConversation(entry) {
  return {
    role: entry.metadata?.role === "assistant" ? "assistant" : "user",
    content: entry.content.replace(/^(user|assistant):\s*/i, ""),
    timestamp: entry.updatedAt
  };
}

export function getContext() {
  return readStore().recall({ type: "conversation", limit: CONTEXT_MESSAGES })
    .map(toConversation)
    .reverse()
    .map(({ role, content }) => ({ role, content }));
}

export function remember(role, content) {
  const text = String(content || "").trim();
  if (!text) return;
  const normalizedRole = role === "assistant" ? "assistant" : "user";
  const store = readStore();
  store.remember({
    type: "conversation",
    content: `${normalizedRole}: ${text}`,
    metadata: { role: normalizedRole, memoryScope: "conversation" },
    source: "conversation",
    confidence: 0.7
  });
  persist(store);
}

export function clearMemory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("haiva_memory_v1");
  } catch (error) {
    console.warn("H.A.I.V.A. memory clear failed:", error);
  }
}

export function getMemoryCount() {
  return readStore().size();
}

export function getRecentMemory(limit = 10) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 20));
  return readStore().recall({ type: "conversation", limit: safeLimit })
    .map(toConversation)
    .reverse();
}

export function forgetLast(count = 2) {
  const store = readStore();
  const recent = store.recall({ type: "conversation", limit: MAX_MESSAGES });
  const safeCount = Math.max(1, Math.min(Number(count) || 2, recent.length));
  recent.slice(-safeCount).forEach(entry => store.forget(entry.id));
  persist(store);
}

export function getMemoryStore() {
  return readStore();
}
