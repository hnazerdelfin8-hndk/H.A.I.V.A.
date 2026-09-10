// =========================================
// H.A.I.V.A. V3 LIVE BARGE-IN RUNTIME
// =========================================
// V3 is interruption/control only.
// It never calls Core App and never owns V1 capture directly.
// V3 reports one interruption outcome to Voice Interaction.

import { createVoiceInteractionV3 } from "./interaction-v3.js";

const controller = createVoiceInteractionV3();
let activeTurn = 0;
let active = false;

function requestV1Capture() {
  if (!active || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("haiva:v3-capture-request", {
    detail: { source: "v3", turn: activeTurn }
  }));
}

function stopV1Capture() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("haiva:v3-capture-stop", {
    detail: { source: "v3", turn: activeTurn }
  }));
}

function reportOutcome(result) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("haiva:v3-voice-outcome", {
    detail: {
      source: "v3",
      turn: activeTurn,
      interrupted: Boolean(result?.interrupted),
      instruction: result?.instruction || ""
    }
  }));
}

function handleBargeIn(text) {
  if (!active) return;
  const result = controller.interrupt(text, activeTurn);
  if (!result.interrupted) return;
  active = false;
  stopV1Capture();
  reportOutcome(result);
}

window.addEventListener("haiva:speech-start", () => {
  active = true;
  activeTurn = controller.beginTurn();
  requestV1Capture();
});

window.addEventListener("haiva:speech-done", () => {
  active = false;
  stopV1Capture();
});

// Native V1 capture result.
window.addEventListener("haiva:native-voice-result", event => {
  const text = event.detail?.text?.trim();
  if (text) handleBargeIn(text);
});

// Browser V1 capture result.
window.addEventListener("haiva:v1-capture-result", event => {
  const text = event.detail?.text?.trim();
  if (text) handleBargeIn(text);
});

console.log("[HAIVA] V3 live barge-in runtime loaded. V3 reports only to Voice Interaction.");
