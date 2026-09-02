// =========================================
// H.A.I.V.A. SKILL — NOTES
// =========================================

const STORAGE_KEY = "haiva_notes_v1";

function loadNotes() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function cleanNote(text) {
  return text
    .replace(/^\s*(take|make|write|save|add)\s+(a\s+)?note\s*/i, "")
    .replace(/^\s*(note|notes)\s*/i, "")
    .replace(/^\s*(this|that)\s*[:,-]?\s*/i, "")
    .replace(/^\s*(down|for me)\s*/i, "")
    .trim();
}

export function notes(command) {
  const text = String(command || "").trim();
  const note = cleanNote(text);
  if (!note) return "What would you like me to save as a note?";

  const items = loadNotes();
  items.push({ id: crypto.randomUUID(), text: note, createdAt: Date.now() });
  saveNotes(items);
  return `Saved that note, Master: ${note}`;
}

export function getNotes() {
  return loadNotes().sort((a, b) => b.createdAt - a.createdAt);
}

export function clearNotes() {
  localStorage.removeItem(STORAGE_KEY);
}
