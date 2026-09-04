// =========================================
// H.A.I.V.A. STAGE 5 — ADVANCED MEMORY
// =========================================
// Backward-compatible, deterministic in-process memory layer.
// No external dependency and safe for browser + Node test environments.

const MAX_ENTRIES = 1000;
const DEFAULT_RECALL_LIMIT = 10;
const DEFAULT_CONFIDENCE = 0.5;
const TYPES = new Set(["fact", "preference", "project", "task", "decision", "conversation"]);

export function createAdvancedMemoryStore(initialEntries = [], options = {}) {
  const maxEntries = clampInt(options.maxEntries, 1, MAX_ENTRIES, MAX_ENTRIES);
  const entries = normalizeEntries(initialEntries).slice(-maxEntries);

  return {
    entries,
    remember(input, content, metadata = {}) {
      const candidate = typeof input === "object" && input !== null
        ? input
        : { type: input, content, metadata };
      const entry = buildEntry(candidate);
      const duplicate = findDuplicate(entries, entry);
      if (duplicate) {
        return mergeEntry(duplicate, entry);
      }
      entries.push(entry);
      trim(entries, maxEntries);
      return entry;
    },
    recall({ query = "", type, limit = DEFAULT_RECALL_LIMIT, minConfidence = 0, includeExpired = false } = {}) {
      const now = Date.now();
      const safeLimit = clampInt(limit, 1, 50, DEFAULT_RECALL_LIMIT);
      return entries
        .filter(entry => !type || entry.type === type)
        .filter(entry => entry.confidence >= Number(minConfidence || 0))
        .filter(entry => includeExpired || !isExpired(entry, now))
        .map(entry => ({ entry, score: relevanceScore(entry, query) }))
        .filter(item => !String(query).trim() || item.score > 0)
        .sort((a, b) => b.score - a.score || Date.parse(b.entry.updatedAt) - Date.parse(a.entry.updatedAt))
        .slice(0, safeLimit)
        .map(item => ({ ...item.entry, relevance: Number(item.score.toFixed(4)) }));
    },
    consolidate({ max = 100 } = {}) {
      const groups = new Map();
      for (const entry of entries) {
        const key = canonicalText(entry.content);
        const existing = groups.get(key);
        if (!existing) groups.set(key, entry);
        else mergeEntry(existing, entry);
      }
      const consolidated = Array.from(groups.values())
        .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
      entries.splice(0, entries.length, ...consolidated.slice(-clampInt(max, 1, maxEntries, maxEntries)));
      return entries.map(cloneEntry);
    },
    rememberTask(task, metadata = {}) {
      return this.remember({
        type: "task",
        content: task,
        metadata: { ...metadata, memoryScope: "task" },
        source: metadata.source || "task-engine",
        confidence: metadata.confidence ?? 0.8
      });
    },
    forget(id) {
      const index = entries.findIndex(entry => entry.id === id);
      if (index === -1) return false;
      entries.splice(index, 1);
      return true;
    },
    forgetExpired(now = Date.now()) {
      const before = entries.length;
      for (let i = entries.length - 1; i >= 0; i--) if (isExpired(entries[i], now)) entries.splice(i, 1);
      return before - entries.length;
    },
    snapshot() {
      return entries.map(cloneEntry);
    },
    export() {
      return JSON.stringify({ version: 1, entries: entries.map(cloneEntry) });
    },
    size() {
      return entries.length;
    }
  };
}

export function importAdvancedMemory(serialized, options = {}) {
  try {
    const parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
    return createAdvancedMemoryStore(parsed?.entries || [], options);
  } catch {
    return createAdvancedMemoryStore([], options);
  }
}

export function createMemoryAdapter(advancedStore) {
  if (!advancedStore || typeof advancedStore.remember !== "function") throw new Error("Advanced memory store is required.");
  return {
    remember(role, content) {
      return advancedStore.remember({
        type: "conversation",
        content: `${role}: ${String(content || "").trim()}`,
        metadata: { role, memoryScope: "conversation" },
        source: "conversation",
        confidence: 0.7
      });
    },
    getContext(limit = 24) {
      return advancedStore.recall({ type: "conversation", limit }).map(entry => ({
        role: entry.metadata.role === "assistant" ? "assistant" : "user",
        content: entry.content.replace(/^(user|assistant):\s*/i, "")
      })).reverse();
    }
  };
}

function buildEntry(input) {
  const type = TYPES.has(input.type) ? input.type : "conversation";
  const content = String(input.content || "").trim();
  if (!content) throw new Error("Advanced memory content is required.");
  const now = new Date().toISOString();
  const metadata = input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {};
  const confidence = clamp(Number(input.confidence ?? metadata.confidence ?? DEFAULT_CONFIDENCE), 0, 1, DEFAULT_CONFIDENCE);
  return {
    id: input.id || `am-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    content,
    metadata,
    source: String(input.source || metadata.source || "haiva").slice(0, 120),
    confidence,
    importance: clamp(Number(input.importance ?? metadata.importance ?? 0.5), 0, 1, 0.5),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    expiresAt: input.expiresAt || metadata.expiresAt || null
  };
}

function normalizeEntries(entries) {
  return Array.isArray(entries) ? entries.filter(Boolean).map(entry => buildEntry(entry)) : [];
}

function findDuplicate(entries, candidate) {
  const key = canonicalText(candidate.content);
  return entries.find(entry => entry.type === candidate.type && canonicalText(entry.content) === key);
}

function mergeEntry(target, incoming) {
  target.confidence = Math.max(target.confidence, incoming.confidence);
  target.importance = Math.max(target.importance, incoming.importance);
  target.metadata = { ...target.metadata, ...incoming.metadata };
  target.source = target.source || incoming.source;
  target.expiresAt = incoming.expiresAt || target.expiresAt;
  target.updatedAt = incoming.updatedAt || new Date().toISOString();
  return target;
}

function relevanceScore(entry, query) {
  const q = canonicalText(query);
  if (!q) return entry.importance * 0.4 + entry.confidence * 0.4 + recencyScore(entry) * 0.2;
  const tokens = [...new Set(q.split(/\s+/).filter(Boolean))];
  const haystack = canonicalText(`${entry.content} ${JSON.stringify(entry.metadata)} ${entry.type}`);
  const matches = tokens.filter(token => haystack.includes(token)).length;
  if (!matches) return 0;
  const lexical = matches / tokens.length;
  return lexical * 0.7 + entry.importance * 0.15 + entry.confidence * 0.1 + recencyScore(entry) * 0.05;
}

function recencyScore(entry) {
  const ageDays = Math.max(0, (Date.now() - Date.parse(entry.updatedAt)) / 86400000);
  return 1 / (1 + ageDays / 30);
}

function isExpired(entry, now) {
  return Boolean(entry.expiresAt && Date.parse(entry.expiresAt) <= now);
}

function canonicalText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function cloneEntry(entry) {
  return { ...entry, metadata: { ...entry.metadata } };
}

function trim(array, max) {
  if (array.length > max) array.splice(0, array.length - max);
}

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
}
