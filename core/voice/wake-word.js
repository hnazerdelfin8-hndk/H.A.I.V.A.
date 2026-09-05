// =========================================
// H.A.I.V.A. VOICE — WAKE WORD
// Deterministic text-level wake-word matching.
// NOTE: This is not a true always-on acoustic wake-word engine.
// =========================================

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesAtBoundary(text, wakeWord) {
  const value = normalize(text);
  const target = normalize(wakeWord);
  if (!value || !target) return false;
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(target)}(?=\\s|$)`, "i");
  return pattern.test(value);
}

export function containsWakeWord(text, wakeWords = []) {
  const candidates = Array.isArray(wakeWords) ? wakeWords : [];
  return candidates.some(word => matchesAtBoundary(text, word));
}

export function removeWakeWords(text, wakeWords = []) {
  let result = normalize(text);
  const candidates = Array.isArray(wakeWords) ? wakeWords : [];

  for (const wakeWord of candidates) {
    const target = normalize(wakeWord);
    if (!target) continue;
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(target)}(?=\\s|$)`, "ig");
    result = result.replace(pattern, " ");
  }

  return normalize(result);
}

export function normalizeWakeText(text) {
  return normalize(text);
}
