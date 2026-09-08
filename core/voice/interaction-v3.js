// =========================================
// H.A.I.V.A. VOICE — INTERACTION V3
// Event-driven conversation coordinator.
// No fixed grace-period timers.
// =========================================

import { CONFIG } from "../config.js";

const DEFAULT_INTERRUPT_KEYWORDS = [
  "stop",
  "stop muna",
  "teka",
  "teka lang",
  "wait",
  "wait lang",
  "hold on",
  "pause",
  "sandali",
  "sandali lang",
  "hintay",
  "hintay lang",
  "cancel",
  "cancel muna",
  "wag na",
  "huwag na",
  "never mind"
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesPhrase(text, phrase) {
  const value = normalize(text);
  const target = normalize(phrase);
  if (!value || !target) return false;
  return new RegExp(`(?:^|\\s)${escapeRegExp(target)}(?:$|\\s)`, "i").test(value);
}

export function detectVoiceInterrupt(text, keywords = DEFAULT_INTERRUPT_KEYWORDS) {
  const normalized = normalize(text);
  const list = Array.isArray(keywords) ? keywords : DEFAULT_INTERRUPT_KEYWORDS;
  const matched = list.find(keyword => matchesPhrase(normalized, keyword));

  if (!matched) return { interrupted: false, keyword: null, text: normalized };

  return {
    interrupted: true,
    keyword: matched,
    text: normalized,
    remainder: normalize(normalized.replace(new RegExp(`\\b${escapeRegExp(normalize(matched))}\\b`, "i"), " "))
  };
}

export function createVoiceInteractionV3(options = {}) {
  const interruptKeywords = options.interruptKeywords || DEFAULT_INTERRUPT_KEYWORDS;
  let generation = 0;
  let committedGeneration = 0;
  let phase = "READY";

  return {
    beginTurn() {
      generation += 1;
      phase = "LISTENING";
      return generation;
    },

    currentTurn() {
      return generation;
    },

    isCurrent(turn) {
      return Number(turn) === generation;
    },

    setPhase(nextPhase, turn = generation) {
      if (!this.isCurrent(turn)) return false;
      phase = String(nextPhase || "READY");
      return true;
    },

    getPhase() {
      return phase;
    },

    commitResult(turn, text) {
      if (!this.isCurrent(turn) || committedGeneration === turn) return null;
      const value = normalize(text);
      if (!value) return null;
      committedGeneration = turn;
      phase = "RESULT_COMMITTED";
      return { turn, text: value };
    },

    interrupt(text, turn = generation) {
      if (!this.isCurrent(turn)) return null;
      const result = detectVoiceInterrupt(text, interruptKeywords);
      if (!result.interrupted) return null;
      phase = "INTERRUPTED";
      generation += 1;
      committedGeneration = 0;
      return { ...result, interruptedTurn: turn, turn: generation };
    },

    invalidateTurn() {
      generation += 1;
      committedGeneration = 0;
      phase = "READY";
      return generation;
    }
  };
}

/**
 * Runtime V3 integration over the existing V2 app instance.
 * This keeps V2 recognition ownership intact while adding true barge-in:
 * TTS announces its speaking phase, V3 opens the existing recognizer, and
 * interrupt speech cancels TTS before the fresh command is processed.
 */
export function installVoiceInteractionV3() {
  if (typeof window === "undefined" || window.__HAIVA_V3_RUNTIME__) return;
  window.__HAIVA_V3_RUNTIME__ = true;

  const coordinator = createVoiceInteractionV3({
    interruptKeywords: CONFIG.voice.interruptKeywords
  });
  let speakingTurn = 0;

  window.addEventListener("haiva:v3-speaking-start", () => {
    const app = window.HAIVA;
    if (!app || !app.voiceActivated) return;
    speakingTurn = coordinator.beginTurn();
    coordinator.setPhase("SPEAKING", speakingTurn);

    // V2 normally stops recognition before TTS. V3 deliberately reopens the
    // same recognizer during SPEAKING so a spoken interrupt can be detected.
    if (app.nativeVoice) {
      try { window.HaivaBridge.startVoiceCapture(); } catch (error) { console.debug("V3 native barge-in start skipped:", error?.message || error); }
    } else if (app.recognition) {
      try { app.recognition.start(); } catch (error) { console.debug("V3 browser barge-in start skipped:", error?.message || error); }
    }
  });

  const handleInterrupt = text => {
    const app = window.HAIVA;
    if (!app || !app.voiceActivated || !app.isSpeaking) return false;
    const interruption = coordinator.interrupt(text, speakingTurn || coordinator.currentTurn());
    if (!interruption) return false;

    app.pendingVoiceResult = true;
    app.isListening = false;
    app.nativeVoiceReady = false;
    app.isSpeaking = false;
    app.setState("LISTENING");

    try {
      if (app.nativeVoice) window.HaivaBridge.stopVoiceCapture();
      else app.recognition?.stop?.();
    } catch (error) {
      console.debug("V3 recognition stop skipped:", error?.message || error);
    }

    try {
      if (typeof window.HaivaBridge?.stopSpeaking === "function") window.HaivaBridge.stopSpeaking();
      else window.speechSynthesis?.cancel?.();
    } catch (error) {
      console.debug("V3 TTS stop skipped:", error?.message || error);
    }

    if (interruption.remainder) {
      app.isProcessing = false;
      void app.handleResultText(interruption.remainder);
    } else {
      app.pendingVoiceResult = false;
      coordinator.setPhase("LISTENING", interruption.turn);
      app.startListening();
    }
    return true;
  };

  window.addEventListener("haiva:native-voice-partial", event => {
    const text = event.detail?.text?.trim();
    if (text) handleInterrupt(text);
  }, true);

  window.addEventListener("haiva:native-voice-result", event => {
    const text = event.detail?.text?.trim();
    if (text && handleInterrupt(text)) event.stopImmediatePropagation();
  }, true);

  window.addEventListener("haiva:browser-voice-partial", event => {
    const text = event.detail?.text?.trim();
    if (text) handleInterrupt(text);
  }, true);

  window.addEventListener("haiva:v3-speaking-stop", () => {
    const app = window.HAIVA;
    if (!app) return;
    if (app.nativeVoice) {
      try { window.HaivaBridge.stopVoiceCapture(); } catch (error) { console.debug("V3 native barge-in stop skipped:", error?.message || error); }
    }
    coordinator.setPhase("READY");
  });
}

installVoiceInteractionV3();

export { DEFAULT_INTERRUPT_KEYWORDS };
