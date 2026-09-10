// =========================================
// H.A.I.V.A. VOICE INTERACTION BOUNDARY
// =========================================
// Single gateway between V1/V2/V3 and Core App.
// V1 = capture, V2 = lifecycle, V3 = interruption/control.
// Core App must receive voice input/outcomes only through this module.

import { createSpeechRecognition } from "./speech-to-text.js";
import { v1Capture } from "./v1/capture-controller.js";
import { VoiceLifecycleV2 } from "./v2/lifecycle-coordinator.js";
import { createVoiceInteractionV3 } from "./v3/interaction-v3.js";
import { normalizeSpeech, removeWakeWord, hasNativeVoiceBridge, speak } from "../ui-bridge.js";
import { CONFIG } from "../config.js";

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
    this.recognition = null;
    this.nativeVoice = hasNativeVoiceBridge();
    this.active = false;
    this.listening = false;
    this.processing = false;
    this.speaking = false;
    this.intentionalStop = false;
    this.pendingResult = false;
    this.recoveryAttempts = 0;
    this.turn = 0;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.setupRecognition();
    this.setupNativeEvents();
    this.setupV3Outcome();
  }

  reportState(state, previousState) {
    const detail = { state, previousState, source: "voice-interaction" };
    this.onStateChange?.(state, previousState);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.STATE, { detail }));
  }

  reportInput(text, source = "voice") {
    const command = removeWakeWord(normalizeSpeech(String(text || ""))).trim();
    if (!command) return false;
    const detail = { type: "VOICE_INPUT", text: command, source, turn: this.turn };
    this.onInput?.(command, detail);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.INPUT, { detail }));
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
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.OUTCOME, { detail }));
  }

  setupNativeEvents() {
    if (typeof window === "undefined" || !this.nativeVoice) return;
    window.addEventListener("haiva:native-voice-ready", () => {
      if (!this.active || this.speaking || this.processing) return;
      this.listening = true;
      this.lifecycle.activateListening();
    });
    window.addEventListener("haiva:native-voice-begin", () => {
      if (!this.active || this.speaking || this.processing) return;
      this.recoveryAttempts = 0;
      this.listening = true;
      this.lifecycle.activateListening();
    });
    window.addEventListener("haiva:native-voice-partial", event => {
      if (!this.active || this.speaking || this.processing) return;
      const text = normalizeSpeech(event.detail?.text || "");
      if (text) {
        this.listening = true;
        this.onTranscript?.(text);
      }
    });
    window.addEventListener("haiva:native-voice-result", event => {
      if (!this.acceptResult()) return;
      this.listening = false;
      this.pendingResult = false;
      this.reportInput(event.detail?.text, "native-v1");
    });
    window.addEventListener("haiva:native-voice-timeout", () => {
      if (!this.active || this.speaking || this.processing) return;
      this.listening = false;
      this.reportState("READY", this.lifecycle.state);
    });
    window.addEventListener("haiva:native-voice-error", event => {
      if (this.speaking || this.processing) return;
      const code = Number(event.detail?.code);
      this.listening = false;
      if ([1, 6, 7].includes(code) && this.active && this.recoveryAttempts < 4) {
        this.recoveryAttempts += 1;
        this.startListening();
        return;
      }
      this.reportError("native", code);
    });
  }

  setupV3Outcome() {
    if (typeof window === "undefined") return;
    window.addEventListener("haiva:v3-voice-outcome", event => {
      const result = event.detail;
      if (!result?.interrupted) return;
      this.speaking = false;
      this.processing = false;
      this.listening = false;
      this.lifecycle.interruptToThinking();
      this.reportOutcome({
        type: "VOICE_INTERRUPT",
        instruction: result.instruction || "",
        interrupted: true
      });
      if (result.instruction) this.reportInput(result.instruction, "v3-interruption");
    });
  }

  setupRecognition() {
    this.recognition = createSpeechRecognition(CONFIG.voice);
    if (!this.recognition) return;
    this.recognition.onstart = () => {
      if (!this.active || this.speaking || this.processing) return;
      this.intentionalStop = false;
      this.listening = true;
      this.lifecycle.activateListening();
    };
    this.recognition.onspeechstart = () => {
      if (this.active && !this.speaking && !this.processing) this.lifecycle.activateListening();
    };
    this.recognition.onresult = event => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || "";
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      const interim = normalizeSpeech(interimText.trim());
      if (interim) this.onTranscript?.(interim);
      const final = normalizeSpeech(finalText.trim());
      if (!final || !this.acceptResult()) return;
      this.listening = false;
      this.reportInput(final, "browser-v1");
    };
    this.recognition.onerror = event => {
      this.listening = false;
      if (this.processing || this.speaking) return;
      if (["no-speech", "aborted", "audio-capture"].includes(event.error) && this.active && this.recoveryAttempts < 4) {
        this.recoveryAttempts += 1;
        this.startListening();
        return;
      }
      this.reportError("browser", event.error);
    };
    this.recognition.onend = () => {
      this.listening = false;
      if (this.active && !this.intentionalStop && !this.processing && !this.speaking) this.startListening();
    };
  }

  acceptResult() {
    if (!this.active || this.processing || this.speaking || this.pendingResult) return false;
    this.pendingResult = true;
    return true;
  }

  activate() {
    this.initialize();
    if (this.active) return true;
    if (!this.recognition && !this.nativeVoice) {
      this.reportError("availability", "VOICE_UNAVAILABLE");
      return false;
    }
    this.active = true;
    this.turn = this.interruption.beginTurn();
    this.recoveryAttempts = 0;
    this.pendingResult = false;
    this.lifecycle.startSession();
    this.lifecycle.activateListening();
    this.startListening();
    return true;
  }

  deactivate() {
    this.active = false;
    this.processing = false;
    this.speaking = false;
    this.pendingResult = false;
    this.intentionalStop = true;
    this.stopListening();
    this.lifecycle.endSession();
    window.speechSynthesis?.cancel?.();
  }

  startListening() {
    if (!this.active || this.listening || this.processing || this.speaking) return;
    this.intentionalStop = false;
    this.listening = true;
    if (this.nativeVoice) {
      this.lifecycle.activateListening();
      v1Capture.startCapture();
      return;
    }
    if (this.recognition) {
      try { this.recognition.start(); } catch (_) { this.listening = false; }
    }
  }

  stopListening() {
    this.intentionalStop = true;
    this.listening = false;
    v1Capture.stopCapture();
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
    }
  }

  beginProcessing() {
    this.processing = true;
    this.stopListening();
    this.lifecycle.beginThinking();
  }

  async beginSpeaking(text) {
    this.processing = false;
    this.speaking = true;
    this.lifecycle.beginSpeaking();
    try { await speak(text); }
    finally { this.speaking = false; }
  }

  finishCommand(shouldEnd = false) {
    this.processing = false;
    this.pendingResult = false;
    if (shouldEnd || !this.active) {
      this.active = false;
      this.lifecycle.endSession();
      return;
    }
    this.lifecycle.returnToListening();
    this.startListening();
  }

  reportError(source, error) {
    const detail = { type: "VOICE_ERROR", source, error, turn: this.turn };
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(VOICE_INTERACTION_EVENTS.ERROR, { detail }));
    this.onOutcome?.(detail);
  }
}

export const createVoiceInteraction = options => new VoiceInteraction(options);
