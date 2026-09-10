// =========================================
// H.A.I.V.A. V3 LIVE BARGE-IN RUNTIME
// =========================================
// V3 is a post-boot voice control layer. V1 owns recognition capture;
// V2 owns lifecycle/state transitions; V3 only detects interruption,
// fences turns, and requests V1 capture through an explicit event.

import { createVoiceInteractionV3 } from "./interaction-v3.js";
import "../v1/capture-controller.js";
import { stopSpeaking } from "../ui-bridge.js";

const controller = createVoiceInteractionV3();
let activeTurn = 0;
let active = false;

function getApp() { return typeof window !== "undefined" ? window.HAIVA : null; }

function requestV1Capture() {
  if (!active || typeof window === "undefined") return;
  const app = getApp();
  if (!app?.isSpeaking || app.isProcessing) return;
  window.dispatchEvent(new CustomEvent("haiva:v3-capture-request"));
}

function stopV1Capture() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("haiva:v3-capture-stop"));
  }
}

function handleBargeIn(text) {
  if (!active) return;
  const app = getApp();
  if (!app?.isSpeaking) return;
  const result = controller.interrupt(text, activeTurn);
  if (!result.interrupted) return;
  active = false;
  stopV1Capture();
  stopSpeaking();
  if (result.instruction) {
    const instruction = result.instruction;
    setTimeout(() => {
      const currentApp = getApp();
      if (!currentApp) return;
      currentApp.pendingVoiceResult = false;
      void currentApp.handleTextCommand(instruction, true);
    }, 0);
  }
}

window.addEventListener("haiva:speech-start", () => {
  const app = getApp();
  if (!app?.isSpeaking) return;
  active = true;
  activeTurn = controller.beginTurn();
  requestV1Capture();
});

window.addEventListener("haiva:speech-done", () => {
  active = false;
  stopV1Capture();
});

// Native Android V1 capture result.
window.addEventListener("haiva:native-voice-result", event => {
  const text = event.detail?.text?.trim();
  if (text) handleBargeIn(text);
});

// Browser V1 capture result.
window.addEventListener("haiva:v1-capture-result", event => {
  const text = event.detail?.text?.trim();
  if (text) handleBargeIn(text);
});

window.addEventListener("haiva:native-voice-partial", event => {
  if (!active) return;
  const text = event.detail?.text?.trim();
  if (text && getApp()?.isSpeaking) getApp().showTranscript(text);
});

console.log("[HAIVA] V3 live barge-in runtime loaded. V1 owns capture; V3 owns interrupt control.");
