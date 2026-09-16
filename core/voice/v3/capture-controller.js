// =========================================
// H.A.I.V.A. V3 INTERRUPT CAPTURE CONTROLLER
// =========================================
// V3 is now mic-neutral during SPEAKING.
// It does NOT start a second Android SpeechRecognizer because that competes
// with the native audio/TTS path and destabilizes VoiceInteraction.
//
// A future native duplex/low-level detector may call
// routeV3InterruptCandidate(...) directly. V4 remains the only route between
// V3 and VoiceInteraction.

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
  // Keep the existing API for VoiceInteraction compatibility. This only arms
  // V3 logically; it never acquires the Android microphone.
  armed = true;
  return true;
}

function stopCapture() {
  armed = false;
  return true;
}

export const v3Capture = Object.freeze({
  startCapture,
  stopCapture
});
