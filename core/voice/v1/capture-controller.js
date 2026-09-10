// =========================================
// H.A.I.V.A. V1 VOICE CAPTURE CONTROLLER
// =========================================
// V1 is the single owner of voice capture.
// V2 owns lifecycle; V3 may request an interrupt-capture session,
// but V3 never owns SpeechRecognition or the native bridge directly.

const SpeechRecognitionCtor = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

let browserRecognizer = null;
let captureActive = false;

function emitResult(text) {
  const normalized = String(text ?? "").trim();
  if (!normalized || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("haiva:v1-capture-result", {
    detail: { text: normalized, source: "v1" }
  }));
}

function stopBrowserCapture() {
  if (!browserRecognizer) return;
  try { browserRecognizer.abort(); } catch (_) {}
  browserRecognizer = null;
}

function startBrowserCapture() {
  if (!SpeechRecognitionCtor || browserRecognizer || !captureActive) return false;
  try {
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    browserRecognizer = recognition;
    recognition.onresult = event => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0]?.transcript || "";
      }
      if (finalText.trim()) emitResult(finalText);
    };
    recognition.onerror = () => {
      browserRecognizer = null;
      captureActive = false;
    };
    recognition.onend = () => {
      browserRecognizer = null;
      captureActive = false;
    };
    recognition.start();
    return true;
  } catch (error) {
    browserRecognizer = null;
    captureActive = false;
    console.warn("[HAIVA] V1 browser capture unavailable:", error?.message || error);
    return false;
  }
}

function startCapture() {
  if (typeof window === "undefined") return;
  captureActive = true;
  if (window.HaivaBridge?.startVoiceCapture) {
    try {
      window.HaivaBridge.startVoiceCapture();
      return;
    } catch (error) {
      console.warn("[HAIVA] V1 native capture start failed:", error?.message || error);
    }
  }
  startBrowserCapture();
}

function stopCapture() {
  captureActive = false;
  if (typeof window !== "undefined" && window.HaivaBridge?.stopVoiceCapture) {
    try { window.HaivaBridge.stopVoiceCapture(); } catch (_) {}
  }
  stopBrowserCapture();
}

if (typeof window !== "undefined") {
  window.addEventListener("haiva:v3-capture-request", () => {
    const app = window.HAIVA;
    if (!app?.isSpeaking || app.isProcessing) return;
    startCapture();
  });

  window.addEventListener("haiva:v3-capture-stop", stopCapture);
}

export const v1Capture = Object.freeze({ startCapture, stopCapture });
