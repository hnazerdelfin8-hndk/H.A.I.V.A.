// =========================================
// H.A.I.V.A. VOICE INTERACTION
// =========================================
// Single owner/authority for the voice domain.
// V1 = normal input capture worker.
// V2 = lifecycle worker.
// V3 = interruption logic + dedicated interruption capture worker.
// Core App receives voice input/outcomes from this boundary only.

import { v1Capture } from "./v1/capture-controller.js";
import { VoiceLifecycleV2 } from "./v2/lifecycle-coordinator.js";
import { createVoiceInteractionV3 } from "./v3/interaction-v3.js";
import { v3Capture } from "./v3/capture-controller.js";
import { normalizeSpeech, removeWakeWord, hasNativeVoiceBridge, speak, stopSpeaking } from "../ui-bridge.js";

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

    this.lifecycle = new VoiceLifecycleV2({
      onStateChange: (state, previousState) => this.reportState(state, previousState)
    });
    this.interruption = createVoiceInteractionV3();

    this.nativeVoice = hasNativeVoiceBridge();
    this.active = false;
    this.listening = false;
    this.processing = false;
    this.speaking = false;
    this.pendingResult = false;
    this.recoveryAttempts = 0;
    this.turn = 0;
    this.captureSessionId = null;
    this.v3CaptureSessionId = null;
    this.nativeCaptureRestartPending = false;
    this.nativeCaptureRestartTimer = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindV1Events();
    this.bindNativeCaptureEvents();
    this.bindV3CaptureEvents();
  }

  reportState(state, previousState) {
    const detail = { state, previousState, source: "voice-interaction" };
    this.onStateChange?.(state, previousState);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.STATE, { detail }));
    }
  }

  reportInput(text, source = "v1") {
    const command = removeWakeWord(normalizeSpeech(String(text || ""))).trim();
    if (!command) return false;
    const detail = { type: "VOICE_INPUT", text: command, source, turn: this.turn };
    this.onInput?.(command, detail);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.INPUT, { detail }));
    }
    return true;
  }

  reportOutcome(outcome) {
    const detail = {
      type: "VOICE_OUTCOME",
      ...outcome,
      source: "voice-interaction",
      turn: this.turn
    };
    this.onOutcome?.(detail);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.OUTCOME, { detail }));
    }
  }

  acceptNativeCaptureEvent(event, { establish = false } = {}) {
    if (!this.nativeVoice) return true;
    const sessionId = event.detail?.sessionId;
    if (sessionId == null) return false;
    if (establish) {
      if (this.captureSessionId !== null && sessionId !== this.captureSessionId) return false;
      this.captureSessionId = sessionId;
      return true;
    }
    return this.captureSessionId !== null && sessionId === this.captureSessionId;
  }

  acceptNativeV3CaptureEvent(event, { establish = false } = {}) {
    if (!this.nativeVoice) return true;
    const sessionId = event.detail?.sessionId;
    if (sessionId == null) return false;
    if (establish) {
      if (this.v3CaptureSessionId !== null && sessionId !== this.v3CaptureSessionId) return false;
      this.v3CaptureSessionId = sessionId;
      return true;
    }
    return this.v3CaptureSessionId !== null && sessionId === this.v3CaptureSessionId;
  }

  bindV1Events() {
    if (typeof window === "undefined") return;

    window.addEventListener("haiva:v1-capture-result", event => {
      if (!this.active || this.processing || this.pendingResult || this.speaking) return;
      const text = event.detail?.text;
      if (!text) return;
      if (!this.acceptResult()) return;
      this.listening = false;
      this.reportInput(text, event.detail?.source || "v1");
    });

    window.addEventListener("haiva:v1-capture-error", () => {
      if (!this.active || this.processing || this.speaking) return;
      this.listening = false;
      this.lifecycle.returnToListening();
      this.startListening();
    });
  }

  bindV3CaptureEvents() {
    if (typeof window === "undefined") return;

    window.addEventListener("haiva:v3-capture-ready", event => {
      if (!this.active || !this.speaking || this.processing) return;
      if (!this.interruption.isMonitoring(this.turn)) return;
      if (!this.acceptNativeV3CaptureEvent(event, { establish: true })) return;
    });

    window.addEventListener("haiva:v3-capture-begin", event => {
      if (!this.active || !this.speaking || this.processing) return;
      if (!this.interruption.isMonitoring(this.turn)) return;
      if (!this.acceptNativeV3CaptureEvent(event)) return;
    });

    window.addEventListener("haiva:v3-capture-partial", event => {
      if (!this.active || !this.speaking || this.processing) return;
      if (!this.interruption.isMonitoring(this.turn)) return;
      if (!this.acceptNativeV3CaptureEvent(event)) return;
      const text = normalizeSpeech(event.detail?.text || "");
      if (text) this.onTranscript?.(text);
    });

    window.addEventListener("haiva:v3-capture-result", event => {
      if (!this.interruption.isMonitoring(this.turn)) return;
      if (!this.acceptNativeV3CaptureEvent(event)) return;
      if (!this.active || !this.speaking || this.processing) return;
      const text = event.detail?.text;
      if (!text) return;

      const interruption = this.interruption.interrupt(text, this.turn);
      if (interruption.interrupted) {
        this.handleInterruption(interruption);
        return;
      }

      this.v3CaptureSessionId = null;
      this.restartV3CaptureAfterTurn();
    });

    window.addEventListener("haiva:v3-capture-complete", event => {
      if (!this.interruption.isMonitoring(this.turn)) return;
      if (!this.acceptNativeV3CaptureEvent(event)) return;
      if (!this.active || !this.speaking || this.processing) return;
      this.v3CaptureSessionId = null;
      this.restartV3CaptureAfterTurn();
    });

    window.addEventListener("haiva:v3-capture-error", event => {
      if (!this.interruption.isMonitoring(this.turn)) return;
      if (!this.acceptNativeV3CaptureEvent(event)) return;
      if (!this.active || !this.speaking || this.processing) return;
      this.v3CaptureSessionId = null;
      this.restartV3CaptureAfterTurn();
    });
  }

  bindNativeCaptureEvents() {
    if (typeof window === "undefined") return;

    window.addEventListener("haiva:native-speech-start", () => {
      if (!this.active || !this.speaking || this.processing) return;
      if (!this.interruption.isMonitoring(this.turn)) return;
      this.v3CaptureSessionId = null;
      v3Capture.startCapture();
    });

    window.addEventListener("haiva:native-voice-ready", event => {
      if (!this.active || this.processing) return;
      if (!this.acceptNativeCaptureEvent(event, { establish: true })) return;
      this.nativeCaptureRestartPending = false;
      this.lifecycle.activateListening();
      this.listening = true;
    });

    window.addEventListener("haiva:native-voice-begin", event => {
      if (!this.active || this.processing) return;
      if (!this.acceptNativeCaptureEvent(event)) return;
      this.nativeCaptureRestartPending = false;
      this.recoveryAttempts = 0;
      this.lifecycle.activateListening();
      this.listening = true;
    });

    window.addEventListener("haiva:native-voice-segment-end", event => {
      if (!this.active || this.processing) return;
      if (!this.acceptNativeCaptureEvent(event)) return;
      this.listening = true;
    });

    window.addEventListener("haiva:native-voice-partial", event => {
      if (!this.active || this.processing) return;
      if (!this.acceptNativeCaptureEvent(event)) return;
      const text = normalizeSpeech(event.detail?.text || "");
      if (!text) return;
      this.listening = true;
      this.onTranscript?.(text);
    });

    window.addEventListener("haiva:native-voice-result", event => {
      console.info("[HAIVA-VOICE-DIAG] PATCH1_NATIVE_RESULT_IN", {
        sessionId: event.detail?.sessionId ?? null,
        acceptedSessionId: this.captureSessionId,
        textPresent: Boolean(event.detail?.text),
        textLength: String(event.detail?.text || "").length,
        active: this.active,
        processing: this.processing,
        pendingResult: this.pendingResult,
        listening: this.listening,
        speaking: this.speaking,
        turn: this.turn
      });
      if (!this.acceptNativeCaptureEvent(event)) return;
      if (!this.active || this.processing || this.pendingResult || this.speaking) return;
      const text = event.detail?.text;
      if (!text) return;
      if (!this.acceptResult()) return;
      this.listening = false;
      this.captureSessionId = null;
      this.reportInput(text, "native");
    });

    window.addEventListener("haiva:native-voice-complete", event => {
      if (!this.acceptNativeCaptureEvent(event)) return;
      if (!this.active || this.processing || this.speaking) return;
      this.captureSessionId = null;
      this.listening = false;
      this.pendingResult = false;
      this.lifecycle.returnToListening();
      this.restartListeningAfterNativeTurn();
    });

    window.addEventListener("haiva:native-voice-timeout", event => {
      if (!this.acceptNativeCaptureEvent(event)) return;
      if (!this.active || this.processing || this.speaking) return;
      this.captureSessionId = null;
      this.listening = false;
      this.pendingResult = false;
      this.lifecycle.returnToListening();
      this.restartListeningAfterNativeTurn();
    });

    window.addEventListener("haiva:native-voice-error", event => {
      if (!this.acceptNativeCaptureEvent(event)) return;
      if (!this.active || this.processing || this.speaking) return;
      this.captureSessionId = null;
      this.listening = false;
      this.pendingResult = false;
      this.lifecycle.returnToListening();
      this.restartListeningAfterNativeTurn();
    });
  }

  restartListeningAfterNativeTurn() {
    if (!this.active || this.processing || this.speaking) return false;
    this.nativeCaptureRestartPending = true;
    if (this.nativeCaptureRestartTimer) clearTimeout(this.nativeCaptureRestartTimer);
    this.nativeCaptureRestartTimer = setTimeout(() => {
      this.nativeCaptureRestartTimer = null;
      if (!this.active || this.processing || this.speaking) return;
      this.nativeCaptureRestartPending = false;
      this.startListening();
    }, 0);
    return true;
  }

  restartV3CaptureAfterTurn() {
    if (!this.active || !this.speaking || this.processing) return false;
    if (!this.interruption.isMonitoring(this.turn)) return false;
    queueMicrotask(() => {
      if (!this.active || !this.speaking || this.processing) return;
      if (!this.interruption.isMonitoring(this.turn)) return;
      this.v3CaptureSessionId = null;
      v3Capture.startCapture();
    });
    return true;
  }

  handleInterruption(result) {
    const interruptedTurn = this.turn;
    this.turn = result.turn;
    this.speaking = false;
    this.processing = false;
    this.pendingResult = false;
    this.listening = false;
    this.captureSessionId = null;
    this.v3CaptureSessionId = null;

    v3Capture.stopCapture();
    this.interruption.stopMonitoring(interruptedTurn);
    stopSpeaking();
    this.lifecycle.interruptToThinking();
    this.reportOutcome({
      type: "VOICE_INTERRUPT",
      instruction: result.instruction || "",
      interrupted: true,
      previousTurn: result.previousTurn ?? interruptedTurn
    });

    if (result.instruction) {
      queueMicrotask(() => {
        if (!this.active || this.turn !== result.turn) return;
        this.reportInput(result.instruction, "v3-interruption");
      });
    } else if (this.active) {
      queueMicrotask(() => {
        if (!this.active || this.turn !== result.turn) return;
        this.lifecycle.returnToListening();
        this.startListening();
      });
    }
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
      this.reportError("availability", "VOICE_UNAVAILABLE");
      return false;
    }

    this.active = true;
    this.turn = this.interruption.beginTurn();
    this.recoveryAttempts = 0;
    this.pendingResult = false;
    this.captureSessionId = null;
    this.v3CaptureSessionId = null;
    this.lifecycle.startSession();
    this.startListening();
    return true;
  }

  deactivate() {
    this.active = false;
    this.processing = false;
    this.speaking = false;
    this.pendingResult = false;
    this.captureSessionId = null;
    this.v3CaptureSessionId = null;
    this.nativeCaptureRestartPending = false;
    if (this.nativeCaptureRestartTimer) {
      clearTimeout(this.nativeCaptureRestartTimer);
      this.nativeCaptureRestartTimer = null;
    }
    this.stopListening();
    v3Capture.stopCapture();
    this.interruption.stopMonitoring(this.turn);
    this.lifecycle.endSession();
    stopSpeaking();
  }

  startListening({ allowDuringSpeaking = false } = {}) {
    if (!this.active || this.listening || this.processing || this.nativeCaptureRestartPending || (this.speaking && !allowDuringSpeaking)) return false;

    this.captureSessionId = null;
    if (this.nativeVoice) {
      v1Capture.startCapture();
      return true;
    }

    this.listening = true;
    if (!allowDuringSpeaking) this.lifecycle.activateListening();
    v1Capture.startCapture();
    return true;
  }

  stopListening() {
    this.listening = false;
    this.captureSessionId = null;
    v1Capture.stopCapture();
  }

  beginProcessing() {
    if (!this.active) return;
    this.processing = true;
    this.stopListening();
    v3Capture.stopCapture();
    this.v3CaptureSessionId = null;
    this.lifecycle.beginThinking();
  }

  async beginSpeaking(text) {
    if (!this.active) return false;
    this.processing = false;
    this.speaking = true;
    const speakingTurn = this.turn;
    this.stopListening();
    this.lifecycle.beginSpeaking();
    this.interruption.beginMonitoring(speakingTurn);

    if (!this.nativeVoice) {
      v3Capture.startCapture();
    }

    try {
      await speak(text);
    } finally {
      if (this.turn !== speakingTurn) {
        return false;
      }

      this.speaking = false;
      this.v3CaptureSessionId = null;
      this.v3CaptureSessionId = null;
      this.interruption.stopMonitoring(speakingTurn);
      v3Capture.stopCapture();
      this.lifecycle.returnToListening();

      if (this.active) {
        this.startListening();
      }
    }

    return this.turn === speakingTurn;
  }

  finishCommand(shouldEnd = false) {
    this.processing = false;
    this.pendingResult = false;

    if (shouldEnd || !this.active) {
      this.active = false;
      this.stopListening();
      v3Capture.stopCapture();
      this.v3CaptureSessionId = null;
      this.interruption.stopMonitoring(this.turn);
      this.lifecycle.endSession();
      return;
    }

    // VoiceInteraction owns the lifecycle transition.
    // V3 only reports interruption events; it never routes to V1.
    this.lifecycle.returnToListening();
  }

  isConversationActive() {
    return this.lifecycle.isConversationActive();
  }

  shouldEndConversation(command) {
    return this.lifecycle.shouldEndConversation(command);
  }

  reportError(source, error) {
    const detail = { type: "VOICE_ERROR", source, error, turn: this.turn };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.ERROR, { detail }));
    }
    this.onOutcome?.(detail);
  }
}

export const createVoiceInteraction = options => new VoiceInteraction(options);