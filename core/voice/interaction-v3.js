// =========================================
// H.A.I.V.A. VOICE INTERACTION V3
// =========================================
// V3 is a control/stopper layer only.
// It does not own recognition, TTS, boot, V1, or V2 lifecycle state.
// It provides turn-generation fencing and explicit voice interruption.

export const DEFAULT_INTERRUPT_KEYWORDS = Object.freeze([
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
]);

const normalize = value => String(value ?? "")
  .toLowerCase()
  .trim()
  .replace(/\s+/g, " ");

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function detectVoiceInterrupt(text, keywords = DEFAULT_INTERRUPT_KEYWORDS) {
  const normalized = normalize(text);
  if (!normalized) return { interrupted: false, phrase: null };

  const ordered = [...keywords]
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const phrase of ordered) {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=$|\\s|[,.!?])`, "i");
    if (pattern.test(normalized)) {
      return { interrupted: true, phrase };
    }
  }

  return { interrupted: false, phrase: null };
}

export function createVoiceInteractionV3(options = {}) {
  const keywords = Object.freeze([
    ...(options.interruptKeywords ?? DEFAULT_INTERRUPT_KEYWORDS)
  ].map(normalize).filter(Boolean));

  let generation = 0;
  let committed = false;

  const beginTurn = () => {
    generation += 1;
    committed = false;
    return generation;
  };

  const isCurrent = turn => turn === generation;

  const commitResult = (turn, text) => {
    if (!isCurrent(turn) || committed) return null;
    committed = true;
    return { turn, text: normalize(text) };
  };

  const interrupt = (text, turn = generation) => {
    const detection = detectVoiceInterrupt(text, keywords);
    if (!detection.interrupted) {
      return {
        interrupted: false,
        phrase: null,
        turn: generation
      };
    }

    // Invalidate the interrupted turn and immediately open a fresh generation.
    // This prevents late recognition/TTS/network callbacks from winning.
    const nextTurn = beginTurn();
    return {
      interrupted: true,
      phrase: detection.phrase,
      previousTurn: turn,
      turn: nextTurn
    };
  };

  return Object.freeze({
    beginTurn,
    isCurrent,
    commitResult,
    interrupt
  });
}
