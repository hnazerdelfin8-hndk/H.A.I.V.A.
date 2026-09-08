// =========================================
// H.A.I.V.A. VOICE — INTERACTION V3
// Event-driven conversation coordinator.
// No fixed grace-period timers.
// =========================================

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

/**
 * Classifies spoken input that arrives while H.A.I.V.A. is speaking.
 * Short interrupt phrases are treated as commands; normal sentences are not.
 */
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

/**
 * Lightweight V3 turn coordinator.
 * The app remains the owner of actual recognition/TTS; this module only owns
 * conversation turn identity, duplicate commits, stale-event rejection, and
 * interrupt classification.
 */
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

export { DEFAULT_INTERRUPT_KEYWORDS };
