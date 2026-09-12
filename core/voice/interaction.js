// =========================================
// H.A.I.V.A. VOICE INTERACTION
// =========================================
// Single owner/authority for the voice domain.
// V1 = capture worker. V2 = lifecycle worker. V3 = stopper/interruption worker.

import { v1Capture } from "./v1/capture-controller.js";
import { VoiceLifecycleV2 } from "./v2/lifecycle-coordinator.js";
import { createVoiceInteractionV3 } from "./v3/interaction-v3.js";
import { normalizeSpeech, removeWakeWord, hasNativeVoiceBridge, speak } from "../ui-bridge.js";

export const VOICE_INTERACTION_EVENTS = Object.freeze({
  INPUT: "haiva:voice-interaction-input",
  OUTCOME: "haiva:voice-interaction-outcome",
  STATE: "haiva:voice-interaction-state",
  ERROR: "haiva:voice-interaction-error"
});

export class VoiceInteraction {
  constructor({ onInput = null, onOutcome = null, onStateChange = null, onTranscript = null } = {}) {
    this.onInput = typeof onInput === "function" ? onInput : null;
    this.onOutcome = typeof onOutcome === "function" ? onOutcome : null;
    this.onStateChange = typeof onStateChange === "function" ? onStateChange : null;
    this.onTranscript = typeof onTranscript === "function" ? onTranscript : null;
    this.lifecycle = new VoiceLifecycleV2({ onStateChange: (state, previousState) => this.reportState(state, previousState) });
    this.interruption = createVoiceInteractionV3();
    this.nativeVoice = hasNativeVoiceBridge();
    this.active = false;
    this.listening = false;
    this.processing = false;
    this.speaking = false;
    this.pendingResult = false;
    this.recoveryAttempts = 0;
    this.turn = 0;
    this.captureSession = 0;
    this.activeCaptureSession = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindV1Events();
    this.bindNativeCaptureEvents();
  }

  reportState(state, previousState) {
    const detail = { state, previousState, source: "voice-interaction" };
    this.onStateChange?.(state, previousState);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.STATE, { detail }));
  }

  reportInput(text, source = "v1") {
    const command = removeWakeWord(normalizeSpeech(String(text || ""))).trim();
    if (!command) return false;
    const detail = { type: "VOICE_INPUT", text: command, source, turn: this.turn };
    this.onInput?.(command, detail);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.INPUT, { detail }));
    return true;
  }

  reportOutcome(outcome) {
    const detail = { type: "VOICE_OUTCOME", ...outcome, source: "voice-interaction", turn: this.turn };
    this.onOutcome?.(detail);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.OUTCOME, { detail }));
  }

  isCurrentCaptureEvent(event) {
    const eventSession = event?.detail?.sessionId;
    return !eventSession || eventSession === this.activeCaptureSession;
  }

  bindV1Events() {
    if (typeof window === "undefined") return;
    window.addEventListener("haiva:v1-capture-result", event => {
      if (!this.active || this.processing || this.pendingResult || !this.isCurrentCaptureEvent(event)) return;
      const text = event.detail?.text;
      if (!text) return;
      if (this.speaking) {
        const interruption = this.interruption.interrupt(text, this.turn);
        if (interruption.interrupted) { this.handleInterruption(interruption); return; }
      }
      if (!this.acceptResult()) return;
      this.listening = false;
      this.reportInput(text, event.detail?.source || "v1");
    });
    window.addEventListener("haiva:v1-capture-error", event => {
      if (!this.active || this.processing || this.speaking || !this.isCurrentCaptureEvent(event)) return;
      this.finishCaptureReady();
    });
  }

  bindNativeCaptureEvents() {
    if (typeof window === "undefined") return;

    window.addEventListener("haiva:native-voice-ready", event => {
      if (!this.active || this.processing || this.speaking || !this.isCurrentCaptureEvent(event)) return;
      this.listening = true;
    });
    window.addEventListener("haiva:native-voice-begin", event => {
      if (!this.active || this.processing || this.speaking || !this.isCurrentCaptureEvent(event)) return;
      this.recoveryAttempts = 0;
      this.listening = true;
    });
    window.addEventListener("haiva:native-voice-segment-end", event => {
      if (!this.active || this.processing || this.speaking || !this.isCurrentCaptureEvent(event)) return;
      this.listening = true;
    });
    window.addEventListener("haiva:native-voice-partial", event => {
      if (!this.active || this.processing || this.speaking || !this.isCurrentCaptureEvent(event)) return;
      const text = normalizeSpeech(event.detail?.text || "");
      if (!text) return;
      this.listening = true;
      this.onTranscript?.(text);
    });
    window.addEventListener("haiva:native-voice-result", event => {
      if (!this.active || this.processing || this.pendingResult || !this.isCurrentCaptureEvent(event)) return;
      const text = event.detail?.text;
      if (!text) return;
      if (this.speaking) {
        const interruption = this.interruption.interrupt(text, this.turn);
        if (interruption.interrupted) { this.handleInterruption(interruption); return; }
      }
      if (!this.acceptResult()) return;
      this.listening = false;
      this.reportInput(text, "native");
    });
    window.addEventListener("haiva:native-voice-complete", event => {
      if (!this.active || this.processing || this.speaking || !this.isCurrentCaptureEvent(event)) return;
      this.finishCaptureReady();
    });
    window.addEventListener("haiva:native-voice-recoverable", event => {
      if (!this.active || this.processing || this.speaking || !this.isCurrentCaptureEvent(event)) return;
      this.finishCaptureReady();
    });
    window.addEventListener("haiva:native-voice-timeout", event => {
      if (!this.active || this.processing || this.speaking || !this.isCurrentCaptureEvent(event)) return;
      this.finishCaptureReady();
    });
    window.addEventListener("haiva:native-voice-error", event => {
      if (!this.active || this.processing || this.speaking || !this.isCurrentCaptureEvent(event)) return;
      this.finishCaptureReady();
      this.reportError("native", event.detail?.code ?? "unknown");
    });
    window.addEventListener("haiva:native-voice-unavailable", event => {
      if (!this.active || !this.isCurrentCaptureEvent(event)) return;
      this.listening = false;
      this.pendingResult = false;
      this.stopListening();
      this.active = false;
      this.lifecycle.endSession();
      this.reportOutcome({ type: "VOICE_UNAVAILABLE", reason: event.detail?.reason || "native_voice_unavailable" });
    });
  }

  finishCaptureReady() {
    this.listening = false;
    this.pendingResult = false;
    this.invalidateCaptureSession();

    // Capture completion is a turn boundary, not the end of an active
    // conversational voice session. Recover into the next listening turn
    // automatically so the user never has to tap the microphone again.
    if (!this.active || this.processing || this.speaking) {
      this.lifecycle.finishReady();
      return;
    }

    this.lifecycle.finishReady();
    this.lifecycle.startSession();
    this.startListening();
  }

  handleInterruption(result) {
    this.speaking = false;
    this.processing = false;
    this.pendingResult = false;
    this.listening = false;
    this.invalidateCaptureSession();
    this.turn = result.turn;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel?.();
    this.lifecycle.interruptToThinking();
    this.reportOutcome({ type: "VOICE_INTERRUPT", instruction: result.instruction || "", interrupted: true, previousTurn: result.previousTurn });
    if (result.instruction) this.reportInput(result.instruction, "v3-interruption");
    else if (this.active) { this.lifecycle.returnToListening(); this.startListening(); }
  }

  acceptResult() {
    if (!this.active || this.processing || this.pendingResult) return false;
    this.pendingResult = true;
    return true;
  }

  activate() {
    this.initialize();
    if (this.active) return true;
    if (!this.nativeVoice && typeof window !== "undefined" && !(window.SpeechRecognition || window.webkitSpeechRecognition)) {
      this.reportOutcome({ type: "VOICE_UNAVAILABLE", reason: "voice_bridge_unavailable" });
      return false;
    }
    this.active = true;
    this.turn = this.interruption.beginTurn();
    this.recoveryAttempts = 0;
    this.pendingResult = false;
    this.lifecycle.startSession();
    this.startListening();
    return true;
  }

  deactivate() {
    this.active = false;
    this.processing = false;
    this.speaking = false;
    this.pendingResult = false;
    this.stopListening();
    this.lifecycle.endSession();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel?.();
  }

  startListening() {
    if (!this.active || this.listening || this.processing || this.speaking) return false;
    const sessionId = `${++this.captureSession}`;
    this.activeCaptureSession = sessionId;
    this.listening = true;
    this.lifecycle.activateListening();
    v1Capture.startCapture(sessionId);
    return true;
  }

  stopListening() {
    this.listening = false;
    const sessionId = this.activeCaptureSession;
    this.activeCaptureSession = null;
    if (sessionId != null) v1Capture.stopCapture(sessionId);
  }

  invalidateCaptureSession() {
    this.activeCaptureSession = null;
  }

  beginProcessing() {
    if (!this.active) return;
    this.processing = true;
    this.stopListening();
    this.lifecycle.beginThinking();
  }

  async beginSpeaking(text) {
    if (!this.active) return;
    this.processing = false;
    this.speaking = true;
    this.lifecycle.beginSpeaking();
    try { await speak(text); } finally { this.speaking = false; }
  }

  finishCommand(shouldEnd = false) {
    this.processing = false;
    this.pendingResult = false;
    if (shouldEnd || !this.active) {
      this.active = false;
      this.stopListening();
      this.lifecycle.endSession();
      return;
    }
    this.lifecycle.returnToListening();
    this.startListening();
  }

  isConversationActive() { return this.lifecycle.isConversationActive(); }
  shouldEndConversation(command) { return this.lifecycle.shouldEndConversation(command); }

  reportError(source, error) {
    const detail = { type: "VOICE_ERROR", source, error, turn: this.turn };
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.ERROR, { detail }));
    this.onOutcome?.(detail);
  }
}

export const createVoiceInteraction = options => new VoiceInteraction(options);
