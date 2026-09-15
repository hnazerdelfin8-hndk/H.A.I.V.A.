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
    // Patch 1: null means there is no currently accepted native capture.
    // Native Android attaches a monotonically increasing sessionId to every
    // callback, allowing stale recognizer events to be rejected safely.
    this.captureSessionId = null;
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
        }
        return;
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

    // Patch 3: V3 deliberately keeps native capture events alive while TTS is
    // speaking. The capture session is still fenced by Patch 1 sessionId.
    window.addEventListener("haiva:native-voice-ready", event => {
      if (!this.active || this.processing) return;
      if (!this.acceptNativeCaptureEvent(event, { establish: true })) return;
      if (!this.speaking) this.lifecycle.activateListening();
      this.listening = true;
    });

    window.addEventListener("haiva:native-voice-begin", event => {
      if (!this.active || this.processing) return;
      if (!this.acceptNativeCaptureEvent(event)) return;
      this.recoveryAttempts = 0;
      if (!this.speaking) this.lifecycle.activateListening();
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
      if (!this.active || this.processing || this.pendingResult) return;
      const text = event.detail?.text;
      if (!text) return;

      if (this.speaking) {
        const interruption = this.interruption.interrupt(text, this.turn);
        if (interruption.interrupted) {
          this.handleInterruption(interruption);
        }
        // While TTS is speaking, only an explicit V3 interruption is allowed
        // to cross the VoiceInteraction boundary. Ordinary speech is ignored.
        return;
      }

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
      this.startListening();
    });

    window.addEventListener("haiva:native-voice-timeout", event => {
      if (!this.acceptNativeCaptureEvent(event)) return;
      if (!this.active || this.processing || this.speaking) return;
      this.captureSessionId = null;
      this.listening = false;
      this.pendingResult = false;
      this.lifecycle.returnToListening();
      this.startListening();
    });

    window.addEventListener("haiva:native-voice-error", event => {
      if (!this.acceptNativeCaptureEvent(event)) return;
      if (!this.active || this.processing || this.speaking) return;
      this.captureSessionId = null;
      this.listening = false;
      this.pendingResult = false;
      this.lifecycle.returnToListening();
      this.startListening();
    });
  }

  handleInterruption(result) {
    // Patch 4: atomically invalidate the old speaking/capture turn before
    // handing a stop+instruction command back to Core. This prevents late
    // TTS/capture callbacks from completing the interrupted turn.
    const interruptedTurn = this.turn;
    this.turn = result.turn;
    this.speaking = false;
    this.processing = false;
    this.pendingResult = false;
    this.listening = false;
    this.captureSessionId = null;

    // Stop the old TTS first. The JS speech-generation fence in ui-bridge
    // prevents its completion callback from resolving the new turn.
    stopSpeaking();
    this.lifecycle.interruptToThinking();
    this.reportOutcome({
      type: "VOICE_INTERRUPT",
      instruction: result.instruction || "",
      interrupted: true,
      previousTurn: result.previousTurn ?? interruptedTurn
    });

    if (result.instruction) {
      // Let the stop command finish its synchronous native/browser cancellation
      // before Core begins processing the replacement instruction. This keeps
      // the handoff event-driven without introducing an arbitrary sleep.
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
    this.stopListening();
    this.lifecycle.endSession();
    stopSpeaking();
  }

  // V3 may open a capture window while TTS is speaking. Native session ids
  // make that capture window generation-safe without changing V2 lifecycle.
  startListening({ allowDuringSpeaking = false } = {}) {
    if (!this.active || this.listening || this.processing || (this.speaking && !allowDuringSpeaking)) return false;

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
    this.lifecycle.beginThinking();
  }

  async beginSpeaking(text) {
    if (!this.active) return false;
    this.processing = false;
    this.speaking = true;
    const speakingTurn = this.turn;
    this.lifecycle.beginSpeaking();

    this.startListening({ allowDuringSpeaking: true });

    try {
      await speak(text);
    } finally {
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
