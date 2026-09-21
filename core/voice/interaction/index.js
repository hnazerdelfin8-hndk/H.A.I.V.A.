// =========================================
// H.A.I.V.A. VOICE INTERACTION
// =========================================
// Single executor/coordinator for the voice domain.
// Native ASR = normal input capture worker.
// V2 = lifecycle authority.
// Barge-in = interruption capture/decision boundary.
// Duplex = physical audio boundary.
// DuplexAudioController = native speech-onset monitor while TTS is active.
// Brain = semantic decision authority.
//
// IMPORTANT: only one native capture request is active at a time.
// During SPEAKING, Barge-in uses the native duplex monitor. Full STT starts only
// after speech onset is detected and TTS has been stopped.

import { VoiceLifecycleV2 } from "../lifecycle-coordinator.js";
import { createCaptureAdapter } from "../capture/factory.js";
import { createBargeInCoordinator } from "../barge-in.js";
import { VoiceSessionManager } from "../session-manager.js";
import { VoiceTurnFence } from "../turn-fence.js";
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
    this.sessionManager = new VoiceSessionManager();
    this.turnFence = new VoiceTurnFence();
    this.sessionId = null;
    this.bargeIn = createBargeInCoordinator();
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
    this.capture = createCaptureAdapter({
      native: this.nativeVoice,
      onEvent: event => this.handleCaptureEvent(event),
      recognitionConfig: { continuous: false, interimResults: true }
    });
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.capture.initialize();
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
    // DuplexController is the single listener for canonical duplex events.
    // VoiceInteraction receives the fenced callback through its constructor.
  }

  handleBargeInCandidate(candidate) {
    if (!this.active || !this.speaking || this.processing) return false;
    if (!this.bargeIn.isMonitoring(this.turn)) return false;

    const capture = this.bargeIn.commitCapture(this.turn, candidate?.text);
    if (!capture) return false;

    const decision = this.onBrainDecision?.(capture.text, {
      phase: "SPEAKING",
      source: candidate?.source || "barge-in",
      turn: capture.turn
    });

    if (decision?.action === "interrupt") {
      this.handleInterruption(capture, decision);
      return true;
    }

    this.duplexInterruptPending = false;
    this.speaking = false;
    this.bargeIn.releaseCapture(this.turn);
    
    this.lifecycle.returnToListening();
    if (this.active && !this.processing && !this.speaking) {
      this.startListening();
    }
    return true;
  }

  handleDuplexInterruptCandidate(candidate) {
    if (!this.active || !this.speaking || this.processing) return false;
    if (!this.bargeIn.isMonitoring(this.turn)) return false;
    if (candidate?.turn != null && Number(candidate.turn) !== Number(this.turn)) return false;
    this.duplexInterruptPending = true;
    this.duplex.stopPlayback(this.turn);
    this.listening = false;
    this.captureSessionId = null;
    this.pendingResult = false;
    this.capture.start();
    return true;
  }

  handleCaptureEvent(event) {
    const type = event?.type;
    const detail = event?.detail || {};

    if (type === "result") {
      if (this.nativeVoice && !this.acceptNativeCaptureEvent({ detail })) return;
      if (!this.active || this.processing || this.pendingResult) return;
      const text = detail.text || event.text;
      if (!text) return;
      if (this.duplexInterruptPending && this.speaking) {
        this.pendingResult = true;
        this.duplexInterruptPending = false;
        this.listening = false;
        this.captureSessionId = null;
        const capture = this.bargeIn.commitCapture(this.turn, text);
        if (!capture) return;
        const decision = this.onBrainDecision?.(capture.text, { phase: "SPEAKING", source: "barge-in-asr", turn: capture.turn });
        if (decision?.action === "interrupt") this.handleInterruption(capture, decision);
        else {
          this.pendingResult = false;
          this.speaking = false;
          this.bargeIn.releaseCapture(this.turn);
          this.lifecycle.returnToListening();
          this.startListening();
        }
        return;
      }
      if (this.speaking) return;
      if (!this.acceptResult()) return;
      this.listening = false;
      this.captureSessionId = null;
      this.reportInput(text, this.nativeVoice ? "native" : "browser");
      return;
    }

    if (type === "ready" || type === "begin") {
      if (!this.active || this.processing) return;
      if (this.nativeVoice && !this.acceptNativeCaptureEvent({ detail }, { establish: type === "ready" })) return;
      this.nativeCaptureRestartPending = false;
      if (!this.duplexInterruptPending) this.lifecycle.activateListening();
      this.listening = true;
      return;
    }

    if (type === "segment-end") {
      if (!this.active || this.processing) return;
      if (this.nativeVoice && !this.acceptNativeCaptureEvent({ detail })) return;
      this.listening = true;
      return;
    }

    if (type === "partial") {
      if (!this.active || this.processing) return;
      if (this.nativeVoice && !this.acceptNativeCaptureEvent({ detail })) return;
      const text = normalizeSpeech(detail.text || "");
      if (text) this.onTranscript?.(text);
      return;
    }

    if (type === "complete" || type === "timeout" || type === "error") {
      if (this.nativeVoice && !this.acceptNativeCaptureEvent({ detail })) return;
      if (!this.active || this.processing || this.speaking) return;
      this.captureSessionId = null;
      this.listening = false;
      this.pendingResult = false;
      this.lifecycle.returnToListening();
      this.restartListeningAfterNativeTurn();
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
    this.duplexInterruptPending = false;
    this.speaking = false;
    this.processing = false;
    this.pendingResult = false;
    this.listening = false;
    this.captureSessionId = null;

    
    this.turnFence.invalidate();
    this.bargeIn.stopMonitoring(interruptedTurn);
    this.duplex.stopPlayback(interruptedTurn);
    this.turn = this.turnFence.begin();
    this.bargeIn.beginTurn();
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
        if (!this.active || !this.bargeIn.isCurrent(this.turn)) return;
        this.reportInput(decision.instruction, "barge-in");
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
    this.sessionId = this.sessionManager.start();
    this.turn = this.turnFence.begin();
    this.bargeIn.beginTurn();
    this.pendingResult = false;
    this.duplexInterruptPending = false;
    this.captureSessionId = null;
    this.lifecycle.startSession();
    this.startListening();
    return true;
  }

  deactivate() {
    this.active = false;
    this.turnFence.invalidate();
    this.sessionManager.end();
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
    
    this.bargeIn.stopMonitoring(this.turn);
    this.duplex.stop(this.turn);
    this.lifecycle.endSession();
    stopSpeaking();
  }

  startListening() {
    if (!this.active || this.listening || this.processing || this.nativeCaptureRestartPending || this.speaking) return false;
    this.captureSessionId = null;
    this.listening = true;
    this.lifecycle.activateListening();
    if (!this.capture.start()) {
      this.listening = false;
      return false;
    }
    return true;
  }

  stopListening() {
    this.listening = false;
    this.captureSessionId = null;
    this.capture.stop();
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
    if (!this.turnFence.accept(speakingTurn) || !this.sessionManager.isActive(this.sessionId)) return false;
    this.lifecycle.beginSpeaking();
    this.bargeIn.beginMonitoring(speakingTurn);
    if (this.nativeVoice && typeof window !== "undefined" && !this.duplex.isActive()) this.duplex.start(speakingTurn);
    

    try {
      await speak(text);
    } finally {
      if (!this.turnFence.accept(speakingTurn) || this.turn !== speakingTurn || !this.sessionManager.isActive(this.sessionId)) return false;
      // A duplex speech onset has stopped TTS but is still waiting for the
      // post-interrupt STT result. Keep barge-in/VoiceInteraction alive for it.
      if (this.duplexInterruptPending) return false;
      this.speaking = false;
        this.bargeIn.stopMonitoring(speakingTurn);
      
      this.lifecycle.returnToListening();
      if (this.active) this.startListening();
    }
    return this.turn === speakingTurn;
  }

  reportError(type, code) {
    const detail = { type, code, source: "voice-interaction", turn: this.turn };
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.ERROR, { detail }));
  }
}
