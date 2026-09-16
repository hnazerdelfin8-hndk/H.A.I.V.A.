// =========================================
// H.A.I.V.A. V3 VOICE CAPTURE CONTROLLER
// =========================================
// V3 owns only the interruption-capture worker.
// V3 reports interruption events to Voice Interaction.
// V3 requests microphone ownership from V4; it never hands control to V1.

import {
  handoffToV3,
  releaseFromV3,
  registerVoiceCaptureOwner
} from "../v4/gateway.js";

const SpeechRecognitionCtor = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

let browserRecognizer = null;
let captureActive = false;

function emit(name, detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
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
      if (finalText.trim()) emit("haiva:v3-capture-result", { text: finalText.trim(), source: "v3" });
    };

    recognition.onerror = error => {
      browserRecognizer = null;
      captureActive = false;
      emit("haiva:v3-capture-error", { source: "v3", error: error?.error || "unknown" });
    };

    recognition.onend = () => {
      browserRecognizer = null;
      const wasActive = captureActive;
      captureActive = false;
      if (wasActive) emit("haiva:v3-capture-complete", { source: "v3", reason: "capture-ended" });
    };

    recognition.start();
    return true;
  } catch (error) {
    browserRecognizer = null;
    captureActive = false;
    emit("haiva:v3-capture-error", { source: "v3", error: error?.message || "start-failed" });
    return false;
  }
}

function stopUnderlyingCapture() {
  captureActive = false;
  if (typeof window !== "undefined" && window.HaivaBridge?.stopV3VoiceCapture) {
    try { window.HaivaBridge.stopV3VoiceCapture(); } catch (_) {}
  }
  stopBrowserCapture();
}

registerVoiceCaptureOwner("v3", stopUnderlyingCapture);

function startCapture() {
  if (typeof window === "undefined") return false;
  captureActive = true;
  return handoffToV3(() => {
    if (!captureActive) return;
    if (window.HaivaBridge?.startV3VoiceCapture) {
      try {
        window.HaivaBridge.startV3VoiceCapture();
        return;
      } catch (error) {
        console.warn("[HAIVA] V3 native capture start failed:", error?.message || error);
      }
    }
    startBrowserCapture();
  });
}

function stopCapture() {
  return releaseFromV3(stopUnderlyingCapture);
}

export const v3Capture = Object.freeze({
  startCapture,
  stopCapture
});
