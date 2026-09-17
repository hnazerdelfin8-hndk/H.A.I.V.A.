// =========================================
// H.A.I.V.A. V3 INTERRUPT CAPTURE CONTROLLER
// =========================================
// V3 is the logical interruption capture worker.
// It never creates its own recognizer. V4 owns the physical capture route.
// While TTS is active, the preferred physical path is the native duplex
// interrupt monitor. Full STT starts only after speech onset is detected.

import {
  handoffToV3,
  releaseFromV3,
  routeV3InterruptCandidate
} from "../v4/gateway.js";
import { DuplexAudioController } from "../duplex-audio-controller.js";

let armed = false;
let duplexTurn = null;
let duplexMonitor = null;

function dispatchDuplexSpeechStart(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("haiva:v3-duplex-speech-start", { detail }));
}

function ensureDuplexController() {
  if (duplexMonitor) return duplexMonitor;
  duplexMonitor = new DuplexAudioController({
    onInterruptDetected: detail => {
      if (!armed) return;
      dispatchDuplexSpeechStart({
        ...detail,
        turn: detail?.turn ?? duplexTurn,
        source: detail?.source || "native-duplex"
      });
    }
  });
  return duplexMonitor;
}

function startCapture(turn = null) {
  if (typeof window === "undefined") return false;
  armed = true;
  duplexTurn = turn;
  return handoffToV3(() => {
    if (!armed) return;
    const monitor = ensureDuplexController();
    if (monitor.startInterruptMonitor(turn)) return;
    if (window.HaivaBridge?.startV3VoiceCapture) {
      try {
        window.HaivaBridge.startV3VoiceCapture();
      } catch (error) {
        console.warn("[HAIVA] V3 native capture start failed:", error?.message || error);
      }
    }
  });
}

function startRecognitionAfterDuplex() {
  if (!armed || typeof window === "undefined") return false;
  ensureDuplexController().stopInterruptMonitor();
  if (!window.HaivaBridge?.startV3VoiceCapture) return false;
  try {
    window.HaivaBridge.startV3VoiceCapture();
    return true;
  } catch (error) {
    console.warn("[HAIVA] V3 post-duplex recognition start failed:", error?.message || error);
    return false;
  }
}

function stopUnderlyingCapture() {
  armed = false;
  duplexTurn = null;
  ensureDuplexController().stopInterruptMonitor();
  if (typeof window !== "undefined" && window.HaivaBridge?.stopV3VoiceCapture) {
    try { window.HaivaBridge.stopV3VoiceCapture(); } catch (_) {}
  }
}

function stopCapture() {
  return releaseFromV3(stopUnderlyingCapture);
}

export const v3Capture = Object.freeze({
  startCapture,
  startRecognitionAfterDuplex,
  stopCapture
});
