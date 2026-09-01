// =========================================
// H.A.I.V.A. VOICE — TEXT TO SPEECH
// =========================================

export function speakText(text, options = {}) {
  const value = String(text || "").trim();
  if (!value || typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();

  return new Promise(resolve => {
    const utterance = new SpeechSynthesisUtterance(value);
    if (options.language) utterance.lang = options.language;
    if (Number.isFinite(options.rate)) utterance.rate = options.rate;
    if (Number.isFinite(options.pitch)) utterance.pitch = options.pitch;
    if (Number.isFinite(options.volume)) utterance.volume = options.volume;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
  });
}
