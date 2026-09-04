// =========================================
// H.A.I.V.A. VOICE — SPEECH TO TEXT
// Canonical speech-recognition factory for Layer 5.
// =========================================

export function createSpeechRecognition(config = {}) {
  if (typeof window === "undefined") return null;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = config.recognitionLanguage || config.language || "en-US";
  recognition.continuous = config.continuous ?? true;
  recognition.interimResults = config.interimResults ?? true;
  recognition.maxAlternatives = config.maxAlternatives || 5;
  return recognition;
}
