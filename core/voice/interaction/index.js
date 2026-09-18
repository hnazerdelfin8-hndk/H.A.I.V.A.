// =========================================
// H.A.I.V.A. VOICE INTERACTION
// =========================================
// Single executor/coordinator for the voice domain.
// V1 = normal input capture worker.
// V2 = lifecycle authority.
// V3 = interruption capture/decision boundary.
// V4 = physical capture routing + interrupt gateway.
// DuplexAudioController = native speech-onset monitor while TTS is active.
// Brain = semantic decision authority.
//
// IMPORTANT: V1 and V3 never own the physical microphone at the same time.
// During SPEAKING, V3 uses the native duplex monitor. Full STT starts only
// after speech onset is detected and TTS has been stopped.

import { VoiceLifecycleV2 } from "../lifecycle-coordinator.js";
import { createVoiceInteractionV3 } from "../v3-interaction.js";
import { DuplexController } from "../duplex/controller.js";
import { normalizeSpeech, removeWakeWord, hasNativeVoiceBridge, speak, stopSpeaking } from "../../ui-bridge.js";

export const VOICE_INTERACTION_EVENTS = Object.freeze({
  INPUT: "haiva:voice-interaction-input",
  OUTCOME: "haiva:voice-interaction-outcome",
  STATE: "haiva:voice-interaction-state",
  ERROR: "haiva:voice-interaction-error"
});

export class VoiceInteraction {
  constructor({ onInput = null, onOutcome = null, onStateChange = null, onTranscript = null, onBrainDecision = null } = {}) {
    this.onInput = typeof onInput === "function" ? onInput : null;
    this.onOutcome = typeof onOutcome === "function" ? onOutcome : null;
    this.onStateChange = typeof onStateChange === "function" ? onStateChange : null;
    this.onTranscript = typeof onTranscript === "function" ? onTranscript : null;
    this.onBrainDecision = typeof onBrainDecision === "function" ? onBrainDecision : null;

    this.lifecycle = new VoiceLifecycleV2({ onStateChange: (state, previousState) => this.reportState(state, previousState) });
    this.interruption = createVoiceInteractionV3();
    this.duplex = new DuplexController({ onInterruptDetected: c => this.handleDuplexInterruptCandidate(c), onError: d => this.reportError("duplex", d?.message || "DUPLEX_ERROR") });
    this.nativeVoice = hasNativeVoiceBridge();
    this.active = false;
    this.listening = false;
    this.processing = false;
    this.speaking = false;
    this.pendingResult = false;
    this.duplexInterruptPending = false;
    this.turn = 0;
    this.captureSessionId = null;
    this.nativeCaptureRestartPending = false;
    this.nativeCaptureRestartTimer = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindNativeCaptureEvents();
    this.bindV3CaptureEvents();
    this.bindDuplexEvents();
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

  bindDuplexEvents() {
    if (typeof window === "undefined") return;
    window.addEventListener("haiva:v3-duplex-speech-start", event => {
      if (!this.active || !this.speaking || this.processing || this.duplexInterruptPending) return;
      if (!this.interruption.isMonitoring(this.turn)) return;
      const turn = event.detail?.turn;
      if (turn != null && Number(turn) !== Number(this.turn)) return;

      // Fence the current TTS completion before stopping output. The pending
      // flag prevents beginSpeaking()'s finally block from releasing V3 before
      // the post-duplex STT session has produced the user's utterance.
      this.duplexInterruptPending = true;
      this.duplex.stopPlayback(this.turn);
      queueMicrotask(() => {
        if (!this.active || !this.speaking || !this.duplexInterruptPending) return;
        this.startListening();
      });
    });
  }

  handleV3InterruptCandidate(candidate) {
    if (!this.active || !this.speaking || this.processing) return false;
    if (!this.interruption.isMonitoring(this.turn)) return false;

    const capture = this.interruption.commitCapture(this.turn, candidate?.text);
    if (!capture) return false;

    const decision = this.onBrainDecision?.(capture.text, {
      phase: "SPEAKING",
      source: candidate?.source || "v3",
      turn: capture.turn
    });

    if (decision?.action === "interrupt") {
      this.handleInterruption(capture, decision);
      return true;
    }

    this.duplexInterruptPending = false;
    this.speaking = false;
    this.interruption.releaseCapture(this.turn);
    
    this.lifecycle.returnToListening();
    if (this.active && !this.processing && !this.speaking) {
      this.startListening();
    }
    return true;
  }

  handleDuplexInterruptCandidate(candidate) {\n    return candidate?.text ? this.handleV3InterruptCandidate({ ...candidate, source: candidate.source || "native-duplex" }) : false;\n  }\n\n\n\n  bindNativeCaptureEvents() {
    if (typeof window === "undefined") return;
    window.addEventListener("haiva:native-voice-ready", event => {
      if (!this.active || this.processing || !this.acceptNativeCaptureEvent(event, { establish: true })) return;
      this.nativeCaptureRestartPending = false;
      this.lifecycle.activateListening();
      this.listening = true;
    });
    window.addEventListener("haiva:native-voice-begin", event => {
      if (!this.active || this.processing || !this.acceptNativeCaptureEvent(event)) return;
      this.nativeCaptureRestartPending = false;
      this.lifecycle.activateListening();
      this.listening = true;
    });
    window.addEventListener("haiva:native-voice-segment-end", event => {
      if (!this.active || this.processing || !this.acceptNativeCaptureEvent(event)) return;
      this.listening = true;
    });
    window.addEventListener("haiva:native-voice-partial", event => {
      if (!this.active || this.processing || !this.acceptNativeCaptureEvent(event)) return;
      const text = normalizeSpeech(event.detail?.text || "");
      if (text) this.onTranscript?.(text);
    });
    window.addEventListener("haiva:native-voice-result", event => {
      if (!this.acceptNativeCaptureEvent(event)) return;
      if (!this.active || this.processing || this.pendingResult || this.speaking) return;
      const text = event.detail?.text;
      if (!text || !this.acceptResult()) return;
      this.listening = false;
      this.captureSessionId = null;
      this.reportInput(text, "native");
    });
    for (const eventName of ["complete", "timeout", "error"]) {
      window.addEventListener(`haiva:native-voice-${eventName}`, event => {
        if (!this.acceptNativeCaptureEvent(event)) return;
        if (!this.active || this.processing || this.speaking) return;
        this.captureSessionId = null;
        this.listening = false;
        this.pendingResult = false;
        this.lifecycle.returnToListening();
        this.restartListeningAfterNativeTurn();
      });
    }
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

  handleInterruption(capture, decision) {
    const interruptedTurn = this.turn;
    this.turn = this.interruption.beginTurn();
    this.duplexInterruptPending = false;
    this.speaking = false;
    this.processing = false;
    this.pendingResult = false;
    this.listening = false;
    this.captureSessionId = null;

    
    this.interruption.stopMonitoring(interruptedTurn);
    this.duplex.stopPlayback(interruptedTurn);
    this.lifecycle.interruptToThinking();
    this.reportOutcome({
      type: "VOICE_INTERRUPT",
      instruction: decision.instruction || "",
      interrupted: true,
      previousTurn: interruptedTurn,
      sourceInput: capture.text
    });

    if (decision.instruction) {
      queueMicrotask(() => {
        if (!this.active || !this.interruption.isCurrent(this.turn)) return;
        this.reportInput(decision.instruction, "v3-interruption");
      });
    } else if (this.active) {
      queueMicrotask(() => {
        if (!this.active) return;
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
    this.pendingResult = false;
    this.duplexInterruptPending = false;
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
    this.duplexInterruptPending = false;
    this.captureSessionId = null;
    this.nativeCaptureRestartPending = false;
    if (this.nativeCaptureRestartTimer) {
      clearTimeout(this.nativeCaptureRestartTimer);
      this.nativeCaptureRestartTimer = null;
    }
    this.stopListening();
    
    this.interruption.stopMonitoring(this.turn);
    this.duplex.stop(this.turn);
    this.lifecycle.endSession();
    stopSpeaking();
  }

  startListening() {
    if (!this.active || this.listening || this.processing || this.nativeCaptureRestartPending || this.speaking) return false;
    this.captureSessionId = null;
    if (!this.nativeVoice) {
      this.listening = true;
      this.lifecycle.activateListening();
    }
    if (this.nativeVoice && typeof window !== "undefined" && typeof window.HaivaBridge?.startDuplexAudio === "function") {
      if (!this.duplex.isActive()) this.duplex.start(this.turn);
    } else if (!this.nativeVoice) {
      // Browser fallback only: native Android never reaches this path.
      this.listening = true;
      this.lifecycle.activateListening();
      const recognition = this._browserRecognition;
      if (recognition) { try { recognition.start(); } catch (_) {} }
    }
    return true;
  }

  stopListening() {
    this.listening = false;
    this.captureSessionId = null;
    if (this.nativeVoice && typeof window !== "undefined" && typeof window.HaivaBridge?.stopDuplexAudio === "function") this.duplex.stop(this.turn);
    else { try { this._browserRecognition?.stop?.(); } catch (_) {} }
  }

  beginProcessing() {
    if (!this.active) return;
    this.processing = true;
    this.stopListening();
    
    this.duplexInterruptPending = false;
    this.lifecycle.beginThinking();
  }

  async beginSpeaking(text) {
    if (!this.active) return false;
    this.processing = false;
    this.speaking = true;
    this.duplexInterruptPending = false;
    const speakingTurn = this.turn;
    this.lifecycle.beginSpeaking();
    this.interruption.beginMonitoring(speakingTurn);
    if (this.nativeVoice && typeof window !== "undefined" && typeof window.HaivaBridge?.startDuplexAudio === "function" && !this.duplex.isActive()) this.duplex.start(speakingTurn);
    

    try {
      await speak(text);
    } finally {
      if (this.turn !== speakingTurn) return false;
      // A duplex speech onset has stopped TTS but is still waiting for the
      // post-interrupt STT result. Keep V3/VoiceInteraction alive for it.
      if (this.duplexInterruptPending) return false;
      this.speaking = false;
        this.interruption.stopMonitoring(speakingTurn);
      
      this.lifecycle.returnToListening();
      if (this.active && !this.duplex.isActive()) this.startListening();
    }
    return this.turn === speakingTurn;
  }

  reportError(type, code) {
    const detail = { type, code, source: "voice-interaction", turn: this.turn };
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.ERROR, { detail }));
  }
}
