// =========================================
// H.A.I.V.A. V3 INTERRUPT CAPTURE CONTROLLER
// =========================================
// V3 is the logical interruption capture worker.
// It never creates its own recognizer. V4 owns the physical capture route.
// Native Android must use the same underlying recognizer/session as V1;
// V3 only changes the logical route while H.A.I.V.A. is speaking.

import {
  handoffToV3,
  releaseFromV3
} from "../v4/gateway.js";
import { routeV3InterruptCandidate } from "../v4/gateway.js";

let armed = false;

if (typeof window !== "undefined") {
  window.addEventListener("haiva:v3-interrupt-signal", event => {
    if (!armed) return;
    const detail = event?.detail || {};
    const text = String(detail.text || "").trim();
    if (!text) return;
    routeV3InterruptCandidate({
      ...detail,
      text,
      source: detail.source || "v3-native-duplex"
    });
  });
}

function startCapture() {
  if (typeof window === "undefined") return false;
  armed = true;
  return handoffToV3(() => {
    if (!armed) return;
    if (window.HaivaBridge?.startV3VoiceCapture) {
      try {
        window.HaivaBridge.startV3VoiceCapture();
        return;
      } catch (error) {
        console.warn("[HAIVA] V3 native capture start failed:", error?.message || error);
      }
    }
  });
}

function stopUnderlyingCapture() {
  armed = false;
  if (typeof window !== "undefined" && window.HaivaBridge?.stopV3VoiceCapture) {
    try { window.HaivaBridge.stopV3VoiceCapture(); } catch (_) {}
  }
}

function stopCapture() {
  return releaseFromV3(stopUnderlyingCapture);
}

export const v3Capture = Object.freeze({ startCapture, stopCapture });
