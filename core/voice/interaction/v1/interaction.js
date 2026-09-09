// =========================================
// H.A.I.V.A. VOICE — INTERACTION V1
// =========================================
// Basic voice-interaction coordinator.
// V1 owns the normal turn lifecycle only.
// Interruption / barge-in belongs to V3 and is intentionally absent here.

const PHASES = Object.freeze({
  READY: "READY",
  LISTENING: "LISTENING",
  PROCESSING: "PROCESSING",
  SPEAKING: "SPEAKING"
});

function cleanText(value) {
  return String(value ?? "").trim();
}

export function createVoiceInteractionV1() {
  let turn = 0;
  let activeTurn = 0;
  let phase = PHASES.READY;

  return Object.freeze({
    phases: PHASES,

    beginListening() {
      turn += 1;
      activeTurn = turn;
      phase = PHASES.LISTENING;
      return activeTurn;
    },

    speechEnded(text) {
      const transcript = cleanText(text);
      if (!transcript || phase !== PHASES.LISTENING) return null;
      phase = PHASES.PROCESSING;
      return { turn: activeTurn, text: transcript };
    },

    beginSpeaking(turnId = activeTurn) {
      if (turnId !== activeTurn || phase !== PHASES.PROCESSING) return false;
      phase = PHASES.SPEAKING;
      return true;
    },

    finishSpeaking(turnId = activeTurn) {
      if (turnId !== activeTurn || phase !== PHASES.SPEAKING) return false;
      phase = PHASES.READY;
      return true;
    },

    reset() {
      phase = PHASES.READY;
      activeTurn = 0;
      return phase;
    },

    getPhase() {
      return phase;
    },

    currentTurn() {
      return activeTurn;
    },

    isCurrent(turnId) {
      return Number(turnId) === activeTurn;
    }
  });
}

export { PHASES as VOICE_INTERACTION_V1_PHASES };
