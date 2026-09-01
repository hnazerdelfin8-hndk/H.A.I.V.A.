// =========================================
// H.A.I.V.A. VOICE — WAKE WORD
// =========================================

export function containsWakeWord(text, wakeWords = []) {
  const value = String(text || "").toLowerCase();
  return (Array.isArray(wakeWords) ? wakeWords : []).some(word => value.includes(String(word).toLowerCase()));
}
