// =========================================
// H.A.I.V.A. VOICE INTERACTION V3
// =========================================
// V3 is a control/stopper layer only.
// It does not own recognition, TTS, boot, V1, or V2 lifecycle state.
// It provides turn-generation fencing, explicit voice interruption,
// and optional "stop + new instruction" extraction.

export const DEFAULT_INTERRUPT_KEYWORDS = Object.freeze([
  "stop",
  "stop muna",
  "hinto",
  "hinto muna",
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
    const escaped = escapeRegExp(phrase);
    const pattern = phrase.includes(" ")
      ? new RegExp(`(^|\\s)${escaped}(?=$|\\s|[,.!?])`, "i")
      : new RegExp(`^${escaped}(?:$|[,.!?])`, "i");

    if (pattern.test(normalized)) {
      return { interrupted: true, phrase };
    }
  }

  return { interrupted: false, phrase: null };
}

export function parseStopAndInstruction(text, keywords = DEFAULT_INTERRUPT_KEYWORDS) {
  const normalized = normalize(text);
  if (!normalized) {
    return { interrupted: false, phrase: null, instruction: "" };
  }

  const ordered = [...keywords]
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const phrase of ordered) {
    const escaped = escapeRegExp(phrase);
    const match = normalized.match(new RegExp(`^${escaped}(?:\\s*[,.:!?-]?\\s+|\\s+|[,.:!?-]+\\s*)(.*)$`, "i"));
    if (!match) continue;

    return {
      interrupted: true,
      phrase,
      instruction: normalize(match[1] ?? "").replace(/[.,!?]+$/, "").trim()
    };
  }

  const detection = detectVoiceInterrupt(normalized, keywords);
  return {
    interrupted: detection.interrupted,
    phrase: detection.phrase,
    instruction: ""
  };
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
    const parsed = parseStopAndInstruction(text, keywords);
    if (!parsed.interrupted) {
      return {
        interrupted: false,
        phrase: null,
        instruction: "",
        turn: generation
      };
    }

    const nextTurn = beginTurn();
    return {
      interrupted: true,
      phrase: parsed.phrase,
      instruction: parsed.instruction,
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
