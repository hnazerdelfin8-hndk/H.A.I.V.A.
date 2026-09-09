// H.A.I.V.A. V3 voice stopper/interruption boundary.
// V3 is intentionally dormant until an explicit V3 event is dispatched.
// V2 remains the canonical conversational voice lifecycle owner.

import { V2_EVENTS, dispatchV2Event } from "../v2/interaction.js";

export const V3_EVENTS = Object.freeze({
  STOP: "haiva:v3-voice-stop",
  COMMAND: "haiva:v3-voice-command",
  INTERRUPTED: "haiva:v3-voice-interrupted"
});

export function dispatchV3Event(name, detail = {}) {
  if (typeof window === "undefined" || !name) return false;
  window.dispatchEvent(new CustomEvent(name, { detail }));
  return true;
}

export function installV3VoiceStopper() {
  if (typeof window === "undefined" || window.__HAIVA_V3_STOPPER_INSTALLED__) return;
  window.__HAIVA_V3_STOPPER_INSTALLED__ = true;

  window.addEventListener(V3_EVENTS.STOP, () => {
    const app = window.HAIVA;
    if (!app) return;

    // V3 is a control boundary only. V2/core still owns voice state changes.
    dispatchV2Event(V2_EVENTS.DEACTIVATE, { source: "v3-stop" });
    dispatchV3Event(V3_EVENTS.INTERRUPTED, { reason: "stop" });
  });

  window.addEventListener(V3_EVENTS.COMMAND, event => {
    const text = event.detail?.text?.trim();
    const app = window.HAIVA;
    if (!text || !app || app.isProcessing) return;

    // An explicit V3 command is handed to the existing core response path.
    // V3 never creates a competing response engine or lifecycle.
    void app.handleResultText?.(text);
  });
}
