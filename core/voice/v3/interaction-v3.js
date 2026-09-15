// =========================================
// H.A.I.V.A. VOICE INTERACTION V3
// =========================================
// V3 is the interruption gateway during SPEAKING.
// It does not own recognition, TTS, V1, or V2 lifecycle state.
// Its only job is to monitor the active speaking turn, detect an
// explicit interruption, extract a new order, invalidate the old turn,
// and return a single handoff result for the VoiceInteraction coordinator.

export const V3_STATES = Object.freeze({
  IDLE: "IDLE",
  MONITORING: "MONITORING",
  INTERRUPTED: "INTERRUPTED",
  HANDOFF: "HANDOFF"
});

export const DEFAULT_INTERRUPT_KEYWORDS = Object.freeze([
  "stop", "stop muna", "hinto", "hinto muna", "teka", "teka lang",
  "wait", "wait lang", "hold on", "pause", "sandali", "sandali lang",
  "hintay", "hintay lang", "cancel", "cancel muna", "wag na", "huwag na",
  "never mind"
]);

const normalize = value => String(value ?? "").toLowerCase().trim().replace(/\s+/g, " ");
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
    const match = normalized.match(
      new RegExp(
        `^${escaped}(?:\\s*[,.:!?-]?\\s+|\\s+|[,.:!?-]+\\s*)(.*)$`,
        "i"
      )
    );

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
  const keywords = Object.freeze(
    [...(options.interruptKeywords ?? DEFAULT_INTERRUPT_KEYWORDS)]
      .map(normalize)
      .filter(Boolean)
  );

  let generation = 0;
  let state = V3_STATES.IDLE;
  let monitoringTurn = null;
  let committed = false;

  const beginTurn = () => {
    generation += 1;
    committed = false;
    state = V3_STATES.IDLE;
    monitoringTurn = null;
    return generation;
  };

  const beginMonitoring = (turn = generation) => {
    if (turn !== generation) return false;
    monitoringTurn = turn;
    state = V3_STATES.MONITORING;
    committed = false;
    return true;
  };

  const stopMonitoring = (turn = generation) => {
    if (monitoringTurn !== null && turn !== monitoringTurn) return false;
    monitoringTurn = null;
    state = V3_STATES.IDLE;
    committed = false;
    return true;
  };

  const getState = () => state;
  const isMonitoring = turn => state === V3_STATES.MONITORING && monitoringTurn === turn;
  const isCurrent = turn => turn === generation;

  const commitResult = (turn, text) => {
    if (!isCurrent(turn) || committed) return null;
    committed = true;
    return { turn, text: normalize(text) };
  };

  const interrupt = (text, turn = generation) => {
    if (!isCurrent(turn)) {
      return {
        interrupted: false,
        phrase: null,
        instruction: "",
        route: "none",
        turn: generation
      };
    }

    const parsed = parseStopAndInstruction(text, keywords);
    if (!parsed.interrupted) {
      return {
        interrupted: false,
        phrase: null,
        instruction: "",
        route: "none",
        turn: generation
      };
    }

    const previousTurn = turn;
    const nextTurn = beginTurn();
    state = V3_STATES.INTERRUPTED;
    monitoringTurn = null;

    return {
      interrupted: true,
      phrase: parsed.phrase,
      instruction: parsed.instruction,
      route: "v1",
      previousTurn,
      turn: nextTurn
    };
  };

  const prepareHandoffToV1 = (turn = generation) => {
    if (!isCurrent(turn)) return null;
    state = V3_STATES.HANDOFF;
    monitoringTurn = null;
    return {
      route: "v1",
      interrupted: false,
      instruction: "",
      turn
    };
  };

  const completeHandoff = (turn = generation) => {
    if (!isCurrent(turn) || state !== V3_STATES.HANDOFF) return false;
    state = V3_STATES.IDLE;
    committed = false;
    return true;
  };

  return Object.freeze({
    beginTurn,
    beginMonitoring,
    stopMonitoring,
    getState,
    isMonitoring,
    isCurrent,
    commitResult,
    interrupt,
    prepareHandoffToV1,
    completeHandoff
  });
}
