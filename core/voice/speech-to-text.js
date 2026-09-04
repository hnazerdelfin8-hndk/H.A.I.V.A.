// =========================================
// H.A.I.V.A. VOICE — SPEECH TO TEXT
// Canonical speech-recognition factory for Layer 5.
// =========================================

function createAndroidRecognition(config = {}) {
  const handlers = {};
  const recognition = {
    lang: config.recognitionLanguage || config.language || "en-US",
    continuous: config.continuous ?? true,
    interimResults: config.interimResults ?? true,
    maxAlternatives: config.maxAlternatives || 5,
    onstart: null,
    onresult: null,
    onerror: null,
    onend: null,
    start() {
      window.__haivaNativeRecognition = recognition;
      window.HAIVA_ANDROID?.startVoiceCapture?.();
    },
    stop() {
      window.HAIVA_ANDROID?.stopVoiceCapture?.();
    },
    abort() {
      window.HAIVA_ANDROID?.stopVoiceCapture?.();
    }
  };

  window.haivaNativeStart = () => recognition.onstart?.();
  window.haivaNativeEnd = () => recognition.onend?.();
  window.haivaNativeError = error => recognition.onerror?.({ error });
  window.haivaNativeResult = (text, isFinal) => {
    const result = [[{ transcript: String(text), confidence: 1 }]];
    result.isFinal = Boolean(isFinal);
    recognition.onresult?.({
      resultIndex: 0,
      results: [result]
    });
  };

  return recognition;
}

export function createSpeechRecognition(config = {}) {
  if (typeof window === "undefined") return null;

  if (window.HAIVA_ANDROID?.startVoiceCapture) {
    return createAndroidRecognition(config);
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = config.recognitionLanguage || config.language || "en-US";
  recognition.continuous = config.continuous ?? true;
  recognition.interimResults = config.interimResults ?? true;
  recognition.maxAlternatives = config.maxAlternatives || 5;
  return recognition;
}
