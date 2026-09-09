// =========================================
// H.A.I.V.A. VOICE — V2 EVENT CONTRACT
// =========================================
// V2 is event-driven. This module is the JS-side contract for the
// conversational voice lifecycle. It contains no speech cutoff timers.

export const V2_STATES = Object.freeze({
  READY: "READY",
  LISTENING: "LISTENING",
  THINKING: "THINKING",
  SPEAKING: "SPEAKING",
  ERROR: "ERROR"
});

export const V2_EVENTS = Object.freeze({
  ACTIVATE: "haiva:v2-voice-activate",
  DEACTIVATE: "haiva:v2-voice-deactivate",
  NATIVE_READY: "haiva:native-voice-ready",
  NATIVE_BEGIN: "haiva:native-voice-begin",
  NATIVE_SEGMENT_END: "haiva:native-voice-segment-end",
  NATIVE_PARTIAL: "haiva:native-voice-partial",
  NATIVE_RESULT: "haiva:native-voice-result",
  NATIVE_TIMEOUT: "haiva:native-voice-timeout",
  NATIVE_ERROR: "haiva:native-voice-error",
  NATIVE_UNAVAILABLE: "haiva:native-voice-unavailable",
  MICROPHONE_READY: "haiva:microphone-ready",
  SPEECH_DONE: "haiva:native-speech-done"
});

export function dispatchV2Event(name, detail = {}) {
  if (typeof window === "undefined") return false;
  if (!Object.values(V2_EVENTS).includes(name)) return false;
  window.dispatchEvent(new CustomEvent(name, { detail }));
  return true;
}

export function isV2State(state) {
  return Object.values(V2_STATES).includes(state);
}

// The UI sends only a V2 command. Core/app.js remains the lifecycle owner.
// This avoids the UI directly toggling internal voice state.
export function installV2VoiceControl() {
  if (typeof window === "undefined" || window.__HAIVA_V2_CONTROL__) return;
  window.__HAIVA_V2_CONTROL__ = true;
  window.addEventListener(V2_EVENTS.ACTIVATE, () => {
    const app = window.HAIVA;
    if (!app) return console.warn("[HAIVA][V2] Core instance is not ready.");
    app.conversationalVoice = true;
    if (!app.voiceActivated) void app.activateVoice();
  });
  window.addEventListener(V2_EVENTS.DEACTIVATE, () => {
    const app = window.HAIVA;
    if (app?.voiceActivated) app.deactivateVoice();
  });
}
