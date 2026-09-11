// =========================================
// H.A.I.V.A. V1 VOICE CAPTURE CONTROLLER
// =========================================
// V1 is the capture worker inside Voice Interaction.
// Voice Interaction owns the session and requests V1 capture.
// V1 never reads or calls Core App, V2, V3, Brain, Skills, Boot, or UI.

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

function emitCaptureError(error) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("haiva:v1-capture-error", {
    detail: { source: "v1", error }
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
    recognition.onerror = error => {
      browserRecognizer = null;
      captureActive = false;
      emitCaptureError(error?.error || "unknown");
    };
    recognition.onend = () => {
      browserRecognizer = null;
      const wasActive = captureActive;
      captureActive = false;
      // A browser recognizer can end without producing a final result.
      // Report that capture boundary so VoiceInteraction can recover instead
      // of leaving the conversational lifecycle stuck in LISTENING.
      if (wasActive) emitCaptureError("capture-ended");
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

export const v1Capture = Object.freeze({ startCapture, stopCapture });
