// =========================================
// H.A.I.V.A. VOICE INTERACTION
// =========================================
// Single owner/authority for the voice domain.
// V1 = capture worker.
// V2 = lifecycle worker.
// V3 = stopper / interruption worker.
// Core App receives voice input/outcomes from this boundary only.

import { v1Capture } from "./v1/capture-controller.js";
import { VoiceLifecycleV2 } from "./v2/lifecycle-coordinator.js";
import { createVoiceInteractionV3 } from "./v3/interaction-v3.js";
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

  bindV1Events() {
    if (typeof window === "undefined") return;

    window.addEventListener("haiva:v1-capture-result", event => {
      if (!this.active || this.processing || this.pendingResult) return;
      const text = event.detail?.text;
      if (!text) return;

      if (this.speaking) {
        const interruption = this.interruption.interrupt(text, this.turn);
        if (interruption.interrupted) {
          this.handleInterruption(interruption);
          return;
        }
      }

      if (!this.acceptResult()) return;
      this.listening = false;
      this.reportInput(text, event.detail?.source || "v1");
    });

    window.addEventListener("haiva:v1-capture-error", event => {
      if (!this.active || this.processing || this.speaking) return;
      this.listening = false;
      this.lifecycle.returnToListening();
      this.startListening();
    });
  }

  bindNativeCaptureEvents() {
    if (typeof window === "undefined") return;

    // Native events are capture telemetry only. VoiceInteraction remains the
    // single coordinator, while V2 remains the sole lifecycle authority.
    window.addEventListener("haiva:native-voice-ready", () => {
      if (!this.active || this.processing || this.speaking) return;
      this.lifecycle.activateListening();
      this.listening = true;
    });

    window.addEventListener("haiva:native-voice-begin", () => {
      if (!this.active || this.processing || this.speaking) return;
      this.recoveryAttempts = 0;
      this.lifecycle.activateListening();
      this.listening = true;
    });

    window.addEventListener("haiva:native-voice-segment-end", () => {
      if (!this.active || this.processing || this.speaking) return;
      this.listening = true;
    });

    window.addEventListener("haiva:native-voice-partial", event => {
      if (!this.active || this.processing || this.speaking) return;
      const text = normalizeSpeech(event.detail?.text || "");
      if (!text) return;
      this.listening = true;
      this.onTranscript?.(text);
    });

    window.addEventListener("haiva:native-voice-result", event => {
      console.info("[HAIVA-VOICE-DIAG] PATCH3_NATIVE_RESULT_IN", {
        textPresent: Boolean(event.detail?.text),
        textLength: String(event.detail?.text || "").length,
        active: this.active,
        processing: this.processing,
        pendingResult: this.pendingResult,
        listening: this.listening,
        speaking: this.speaking,
        turn: this.turn
      });
      if (!this.active || this.processing || this.pendingResult) return;
      const text = event.detail?.text;
      if (!text) return;

      if (this.speaking) {
        const interruption = this.interruption.interrupt(text, this.turn);
        if (interruption.interrupted) {
          this.handleInterruption(interruption);
          return;
        }
      }

      if (!this.acceptResult()) return;
      this.listening = false;
      this.reportInput(text, "native");
    });

    window.addEventListener("haiva:native-voice-complete", () => {
      if (!this.active || this.processing || this.speaking) return;
      this.listening = false;
      this.pendingResult = false;
      // Normal capture completion is part of the event-driven conversation
      // loop. It must re-arm LISTENING, not fall back to READY.
      this.lifecycle.returnToListening();
      this.startListening();
    });

    window.addEventListener("haiva:native-voice-timeout", () => {
      if (!this.active || this.processing || this.speaking) return;
      this.listening = false;
      this.pendingResult = false;
      // A capture timeout is recoverable inside an active conversation.
      this.lifecycle.returnToListening();
      this.startListening();
    });

    window.addEventListener("haiva:native-voice-error", event => {
      if (!this.active || this.processing || this.speaking) return;
      this.listening = false;
      this.pendingResult = false;
      // Recoverable native capture errors stay inside the active voice loop.
      this.lifecycle.returnToListening();
      this.startListening();
    });
  }

  handleInterruption(result) {
    this.speaking = false;
    this.processing = false;
    this.pendingResult = false;
    this.listening = false;
    this.turn = result.turn;

    // Patch 5: stop the actual active TTS path through the unified bridge.
    // This reaches native Android TTS as well as browser speech synthesis.
    stopSpeaking();
    this.lifecycle.interruptToThinking();
    this.reportOutcome({
      type: "VOICE_INTERRUPT",
      instruction: result.instruction || "",
      interrupted: true,
      previousTurn: result.previousTurn
    });

    if (result.instruction) {
      this.reportInput(result.instruction, "v3-interruption");
    } else if (this.active) {
      this.lifecycle.returnToListening();
      this.startListening();
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
    stopSpeaking();
  }

  // Patch 1: V3 may open a capture window while TTS is speaking.
  // This does not change V2 lifecycle state; V3 only needs the capture
  // channel available so an interruption phrase can reach its parser.
  startListening({ allowDuringSpeaking = false } = {}) {
    if (!this.active || this.listening || this.processing || (this.speaking && !allowDuringSpeaking)) return false;

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
    v1Capture.stopCapture();
  }

  beginProcessing() {
    if (!this.active) return;
    this.processing = true;
    this.stopListening();
    this.lifecycle.beginThinking();
  }

  async beginSpeaking(text) {
    if (!this.active) return false;
    this.processing = false;
    this.speaking = true;
    const speakingTurn = this.turn;
    this.lifecycle.beginSpeaking();

    // V3 capture is armed while V2 remains in SPEAKING.
    this.startListening({ allowDuringSpeaking: true });

    try {
      await speak(text);
    } finally {
      // If V3 interrupted this TTS turn, the interruption already advanced
      // the turn generation. Do not let the stale speaking completion reset
      // state or stop the new turn's capture.
      if (this.turn !== speakingTurn) {
        return false;
      }
      this.speaking = false;
      this.stopListening();
    }

    return this.turn === speakingTurn;
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
