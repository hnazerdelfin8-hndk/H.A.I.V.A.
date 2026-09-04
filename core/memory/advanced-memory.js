const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_CONTEXT_LIMIT = 24;
const VALID_TYPES = new Set([
  "fact",
  "preference",
  "project",
  "task",
  "decision",
  "note",
  "summary",
  "agent"
]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(value, fallback = 0.5) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function normalizeEntry(input) {
  if (!input || typeof input !== "object") throw new TypeError("memory entry is required");
  const type = cleanText(input.type).toLowerCase();
  const content = cleanText(input.content);
  if (!type || !VALID_TYPES.has(type)) throw new TypeError("valid memory type is required");
  if (!content) throw new TypeError("memory content is required");

  const now = new Date().toISOString();
  return {
    id: cleanText(input.id) || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    content,
    metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? { ...input.metadata } : {},
    importance: clamp(input.importance, 0.5),
    confidence: clamp(input.confidence, 0.5),
    source: cleanText(input.source) || "system",
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    createdAt: input.createdAt ? new Date(input.createdAt).toISOString() : now,
    updatedAt: now
  };
}

function isExpired(entry) {
  return Boolean(entry?.expiresAt && Date.parse(entry.expiresAt) <= Date.now());
}

function score(entry, query) {
  const terms = cleanText(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return entry.importance * 0.6 + entry.confidence * 0.4;
  const haystack = `${entry.content} ${JSON.stringify(entry.metadata)}`.toLowerCase();
  const matches = terms.filter((term) => haystack.includes(term)).length;
  const lexical = matches / terms.length;
  return lexical * 0.7 + entry.importance * 0.2 + entry.confidence * 0.1;
}

export function createAdvancedMemoryStore(initialEntries = [], options = {}) {
  const maxEntries = Number.isInteger(options.maxEntries) && options.maxEntries > 0
    ? options.maxEntries
    : DEFAULT_MAX_ENTRIES;
  let entries = [];

  const addInitial = Array.isArray(initialEntries) ? initialEntries : [];
  for (const item of addInitial) {
    try { entries.push(normalizeEntry(item)); } catch { /* ignore corrupted initial entries */ }
  }
  entries = entries.slice(-maxEntries);

  function remember(input) {
    const candidate = normalizeEntry(input);
    const duplicate = entries.find((entry) =>
      entry.type === candidate.type && entry.content.toLowerCase() === candidate.content.toLowerCase()
    );
    if (duplicate) {
      Object.assign(duplicate, candidate, { id: duplicate.id, createdAt: duplicate.createdAt, updatedAt: new Date().toISOString() });
      return { ...duplicate };
    }
    entries.push(candidate);
    if (entries.length > maxEntries) entries = entries.slice(-maxEntries);
    return { ...candidate };
  }

  function recall({ type, query = "", limit = 10, includeExpired = false } = {}) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
    const normalizedType = cleanText(type).toLowerCase();
    return entries
      .filter((entry) => !normalizedType || entry.type === normalizedType)
      .filter((entry) => includeExpired || !isExpired(entry))
      .map((entry) => ({ ...entry, relevance: score(entry, query) }))
      .filter((entry) => !cleanText(query) || entry.relevance > 0.09)
      .sort((a, b) => b.relevance - a.relevance || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, safeLimit);
  }

  function consolidate() {
    const seen = new Map();
    for (const entry of entries) {
      const key = `${entry.type}:${entry.content.toLowerCase()}`;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, entry);
        continue;
      }
      existing.importance = Math.max(existing.importance, entry.importance);
      existing.confidence = Math.max(existing.confidence, entry.confidence);
      existing.metadata = { ...existing.metadata, ...entry.metadata };
      existing.updatedAt = new Date().toISOString();
    }
    entries = Array.from(seen.values()).slice(-maxEntries);
    return entries.map((entry) => ({ ...entry }));
  }

  function forget(id) {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    entries.splice(index, 1);
    return true;
  }

  function forgetExpired() {
    const before = entries.length;
    entries = entries.filter((entry) => !isExpired(entry));
    return before - entries.length;
  }

  function exportMemory() {
    return JSON.stringify({ version: 1, entries });
  }

  function size() { return entries.length; }

  function snapshot() { return entries.map((entry) => ({ ...entry, metadata: { ...entry.metadata } })); }

  function rememberTask(content, metadata = {}) {
    return remember({ type: "task", content, metadata: { ...metadata, memoryScope: "task" }, source: metadata.source || "agent" });
  }

  function getContext(limit = DEFAULT_CONTEXT_LIMIT) {
    return recall({ limit: Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_CONTEXT_LIMIT })
      .map((entry) => ({ role: "user", content: entry.content, memoryId: entry.id, type: entry.type }));
  }

  return { remember, recall, consolidate, forget, forgetExpired, export: exportMemory, size, snapshot, rememberTask, getContext };
}

export function importAdvancedMemory(serialized) {
  try {
    const parsed = JSON.parse(serialized);
    const source = Array.isArray(parsed) ? parsed : parsed?.entries;
    return createAdvancedMemoryStore(Array.isArray(source) ? source : []);
  } catch {
    return createAdvancedMemoryStore();
  }
}

export function createMemoryAdapter(memory, options = {}) {
  if (!memory || typeof memory.remember !== "function") throw new TypeError("memory store is required");
  const contextLimit = Number.isInteger(options.contextLimit) && options.contextLimit > 0 ? options.contextLimit : DEFAULT_CONTEXT_LIMIT;
  return {
    remember(role, content, metadata = {}) {
      return memory.remember({ type: role === "user" ? "note" : "agent", content, metadata: { ...metadata, role }, source: role });
    },
    getContext(limit = contextLimit) {
      if (typeof memory.getContext === "function") return memory.getContext(limit);
      return memory.recall({ limit }).map((entry) => ({ role: entry.metadata?.role || "user", content: entry.content, memoryId: entry.id }));
    }
  };
}
