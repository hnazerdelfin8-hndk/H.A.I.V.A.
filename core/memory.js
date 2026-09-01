// =========================================
// H.A.I.V.A. MEMORY & CONTEXT LAYER
// =========================================

const STORAGE_KEY = "haiva_memory_v1";
const MAX_MESSAGES = 30;

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
  return loadMemory().slice(-20);
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
  } catch (error) {
    console.warn("H.A.I.V.A. memory clear failed:", error);
  }
}

export function getMemoryCount() {
  return loadMemory().length;
}
