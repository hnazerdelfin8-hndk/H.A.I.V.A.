// =========================================
// H.A.I.V.A. V3 INTERRUPT CAPTURE CONTROLLER
// =========================================
// Flat module: logical interruption capture adapter.

import { handoffToV3, releaseFromV3, routeV3InterruptCandidate } from "./voice-gateway.js";
import { DuplexAudioController } from "./duplex-audio-controller.js";

let armed = false;
let duplexTurn = null;
let duplexMonitor = null;

if (typeof window !== "undefined") {
  window.addEventListener("haiva:v3-interrupt-signal", event => {
    if (!armed) return;
    const detail = event?.detail || {};
    const text = String(detail.text || "").trim();
    if (!text) return;
    routeV3InterruptCandidate({ ...detail, text, source: detail.source || "v3-native" });
  });
}

function dispatchDuplexSpeechStart(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("haiva:v3-duplex-speech-start", { detail }));
}

function ensureDuplexController() {
  if (duplexMonitor) return duplexMonitor;
  duplexMonitor = new DuplexAudioController({
    onInterruptDetected: detail => {
      if (!armed) return;
      dispatchDuplexSpeechStart({ ...detail, turn: detail?.turn ?? duplexTurn, source: detail?.source || "native-duplex" });
    },
    onError: detail => {
      if (!armed) return;
      console.warn("[HAIVA] Duplex interrupt monitor unavailable:", detail?.reason || detail?.message || "unknown error");
      duplexMonitor?.stopInterruptMonitor();
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
      try { window.HaivaBridge.startV3VoiceCapture(); } catch (error) { console.warn("[HAIVA] V3 native capture start failed:", error?.message || error); }
    }
  });
}

function startRecognitionAfterDuplex() {
  if (!armed || typeof window === "undefined") return false;
  ensureDuplexController().stopInterruptMonitor();
  if (!window.HaivaBridge?.startV3VoiceCapture) return false;
  try { window.HaivaBridge.startV3VoiceCapture(); return true; } catch (error) { console.warn("[HAIVA] V3 post-duplex recognition start failed:", error?.message || error); return false; }
}

function stopUnderlyingCapture() {
  armed = false;
  duplexTurn = null;
  ensureDuplexController().stopInterruptMonitor();
  if (typeof window !== "undefined" && window.HaivaBridge?.stopV3VoiceCapture) { try { window.HaivaBridge.stopV3VoiceCapture(); } catch (_) {} }
}
function stopCapture() { return releaseFromV3(stopUnderlyingCapture); }

export const v3Capture = Object.freeze({ startCapture, startRecognitionAfterDuplex, stopCapture });
