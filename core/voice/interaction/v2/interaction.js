// =========================================
// H.A.I.V.A. VOICE — V2 EVENT CONTRACT
// =========================================
// V2 is event-driven. This module is the single JS-side contract for the
// conversational voice lifecycle. It deliberately contains no timers and no
// UI/Android implementation logic.

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
