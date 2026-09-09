// H.A.I.V.A. V3 voice stopper/interruption boundary.
// V3 is intentionally dormant until an explicit V3 event is dispatched.
// V2 remains the canonical conversational voice lifecycle owner.

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

    // Stop is an explicit user/system command. It must not alter boot state
    // and must not become a second voice lifecycle/state machine.
    app.stopListening?.();
    window.speechSynthesis?.cancel?.();
    app.isSpeaking = false;
    app.pendingVoiceResult = false;
    app.nativeVoiceReady = false;
    app.voiceActivated = false;
    app.voiceSilenceRetries = 0;
    app.setVoiceButtonActive?.(false);
    app.setState?.("READY");

    dispatchV3Event(V3_EVENTS.INTERRUPTED, { reason: "stop" });
  });

  window.addEventListener(V3_EVENTS.COMMAND, event => {
    const text = event.detail?.text?.trim();
    const app = window.HAIVA;
    if (!text || !app || app.isProcessing) return;

    // V3 may hand an explicit interrupt/new command to the existing core
    // response pipeline. It never creates a competing response engine.
    void app.handleResultText?.(text);
  });
}
