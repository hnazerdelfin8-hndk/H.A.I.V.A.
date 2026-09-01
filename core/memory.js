// =========================================
// H.A.I.V.A. MEMORY & CONTEXT LAYER
// =========================================

const STORAGE_KEY = "haiva_memory_v2";
const MAX_MESSAGES = 50;
const CONTEXT_MESSAGES = 24;

function loadMemory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("H.A.I.V.A. memory load failed:", error);
    return [];
  }
}

function saveMemory(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  } catch (error) {
    console.warn("H.A.I.V.A. memory save failed:", error);
  }
}

export function getContext() {
  return loadMemory()
    .filter(item => item && (item.role === "user" || item.role === "assistant") && item.content)
    .slice(-CONTEXT_MESSAGES)
    .map(({ role, content }) => ({ role, content }));
}

export function remember(role, content) {
  const text = String(content || "").trim();
  if (!text) return;

  const messages = loadMemory();
  messages.push({
    role: role === "assistant" ? "assistant" : "user",
    content: text,
    timestamp: Date.now()
  });
  saveMemory(messages);
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
  return loadMemory().length;
}

export function getRecentMemory(limit = 10) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 20));
  return loadMemory().slice(-safeLimit);
}

export function forgetLast(count = 2) {
  const messages = loadMemory();
  const safeCount = Math.max(1, Math.min(Number(count) || 2, messages.length));
  messages.splice(-safeCount, safeCount);
  saveMemory(messages);
}
