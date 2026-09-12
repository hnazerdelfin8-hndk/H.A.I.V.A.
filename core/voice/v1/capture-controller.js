// =========================================
// H.A.I.V.A. V1 VOICE CAPTURE CONTROLLER
// =========================================
// V1 is capture-only. VoiceInteraction owns session identity and lifecycle.

const SpeechRecognitionCtor = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

let browserRecognizer = null;
let captureActive = false;
let activeSessionId = null;

function emitResult(text, sessionId) {
  const normalized = String(text ?? "").trim();
  if (!normalized || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("haiva:v1-capture-result", {
    detail: { text: normalized, source: "v1", sessionId }
  }));
}

function emitCaptureError(error, sessionId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("haiva:v1-capture-error", {
    detail: { source: "v1", error, sessionId }
  }));
}

function stopBrowserCapture() {
  if (!browserRecognizer) return;
  try { browserRecognizer.abort(); } catch (_) {}
  browserRecognizer = null;
}

function startBrowserCapture(sessionId) {
  if (!SpeechRecognitionCtor || browserRecognizer || !captureActive) return false;
  try {
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    browserRecognizer = recognition;
    recognition.onresult = event => {
      if (!captureActive || activeSessionId !== sessionId) return;
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0]?.transcript || "";
      }
      if (finalText.trim()) emitResult(finalText, sessionId);
    };
    recognition.onerror = error => {
      if (activeSessionId !== sessionId) return;
      browserRecognizer = null;
      captureActive = false;
      emitCaptureError(error?.error || "unknown", sessionId);
    };
    recognition.onend = () => {
      if (activeSessionId !== sessionId) return;
      browserRecognizer = null;
      const wasActive = captureActive;
      captureActive = false;
      if (wasActive) emitCaptureError("capture-ended", sessionId);
    };
    recognition.start();
    return true;
  } catch (error) {
    if (activeSessionId === sessionId) {
      browserRecognizer = null;
      captureActive = false;
      console.warn("[HAIVA] V1 browser capture unavailable:", error?.message || error);
      emitCaptureError(error?.message || "capture-start-failed", sessionId);
    }
    return false;
  }
}

function startCapture(sessionId) {
  if (typeof window === "undefined") return;
  activeSessionId = String(sessionId);
  captureActive = true;
  if (window.HaivaBridge?.startVoiceCapture) {
    try { window.HaivaBridge.startVoiceCapture(activeSessionId); return; }
    catch (error) { console.warn("[HAIVA] V1 native capture start failed:", error?.message || error); }
  }
  startBrowserCapture(activeSessionId);
}

function stopCapture(sessionId) {
  if (String(sessionId) !== String(activeSessionId)) return;
  captureActive = false;
  activeSessionId = null;
  if (typeof window !== "undefined" && window.HaivaBridge?.stopVoiceCapture) {
    try { window.HaivaBridge.stopVoiceCapture(String(sessionId)); } catch (_) {}
  }
  stopBrowserCapture();
}

export const v1Capture = Object.freeze({ startCapture, stopCapture });
