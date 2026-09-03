// =========================================
// H.A.I.V.A. PHASE 7 — PROJECT MEMORY
// =========================================

const MAX_ENTRIES = 500;
const ALLOWED_TYPES = new Set(["project", "task", "decision"]);

export function createMemoryStore(initialEntries = []) {
  const entries = Array.isArray(initialEntries)
    ? initialEntries.filter(isValidEntry).slice(-MAX_ENTRIES)
    : [];

  return {
    entries,
    remember(type, content, metadata = {}) {
      if (!ALLOWED_TYPES.has(type)) throw new Error(`Invalid memory type: ${type}`);
      const text = String(content || "").trim();
      if (!text) throw new Error("Memory content is required.");

      const entry = {
        id: `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        content: text,
        metadata: metadata && typeof metadata === "object" ? { ...metadata } : {},
        createdAt: new Date().toISOString()
      };

      entries.push(entry);
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
      return entry;
    },
    recall({ type, query, limit = 10 } = {}) {
      const normalizedQuery = String(query || "").trim().toLowerCase();
      const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));

      return entries
        .filter(entry => !type || entry.type === type)
        .filter(entry => !normalizedQuery || `${entry.content} ${JSON.stringify(entry.metadata)}`.toLowerCase().includes(normalizedQuery))
        .slice(-safeLimit)
        .reverse();
    },
    forget(id) {
      const index = entries.findIndex(entry => entry.id === id);
      if (index === -1) return false;
      entries.splice(index, 1);
      return true;
    },
    snapshot() {
      return entries.map(entry => ({ ...entry, metadata: { ...entry.metadata } }));
    }
  };
}

function isValidEntry(entry) {
  return Boolean(
    entry &&
    typeof entry === "object" &&
    ALLOWED_TYPES.has(entry.type) &&
    String(entry.content || "").trim()
  );
}
