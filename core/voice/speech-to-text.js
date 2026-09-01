// =========================================
// H.A.I.V.A. VOICE — SPEECH TO TEXT
// =========================================

export function createSpeechRecognition(config = {}) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = config.language || "en-US";
  recognition.continuous = config.continuous ?? true;
  recognition.interimResults = config.interimResults ?? true;
  recognition.maxAlternatives = config.maxAlternatives || 5;
  return recognition;
}
