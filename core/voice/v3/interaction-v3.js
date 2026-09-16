// =========================================
// H.A.I.V.A. VOICE INTERACTION V3
// =========================================
// V3 is the interruption sensor during SPEAKING.
// It does not own recognition, TTS, V1, V2 lifecycle state, or routing.
// Its job is to monitor the active speaking turn, detect an explicit
// interruption, extract an optional new order, and invalidate the old turn.
// Mic ownership / routing belongs to the future V4 layer.

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

const DIRECT_CUES = Object.freeze(["please", "okay", "ok", "can you", "could you"]);
const COMMAND_SUFFIXES = Object.freeze(["now"]);

export function detectVoiceInterrupt(text, keywords = DEFAULT_INTERRUPT_KEYWORDS) {
  const normalized = normalize(text);
  if (!normalized) return { interrupted: false, phrase: null };

  const ordered = [...keywords]
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const phrase of ordered) {
    const escaped = escapeRegExp(phrase);
    const boundary = `(^|\\s)${escaped}(?=$|\\s|[,.!?])`;
    const pattern = new RegExp(boundary, "i");

    if (!pattern.test(normalized)) continue;

    // Multi-word commands are explicit enough to match anywhere in natural speech.
    if (phrase.includes(" ")) {
      return { interrupted: true, phrase };
    }

    // Single-word commands need interruption context so ordinary speech such as
    // "the wait time is three seconds" does not stop TTS accidentally.
    const tokenMatch = normalized.match(new RegExp(boundary, "i"));
    if (!tokenMatch) continue;

    const index = tokenMatch.index ?? -1;
    const before = normalized.slice(0, index).trim();
    const after = normalized.slice(index + tokenMatch[0].length).trim();

    const beforeCue = DIRECT_CUES.some(cue =>
      new RegExp(`(?:^|\\s)${escapeRegExp(cue)}\\s*$`, "i").test(before)
    );
    const afterCue = DIRECT_CUES.some(cue =>
      new RegExp(`^${escapeRegExp(cue)}(?:\\s|$)`, "i").test(after)
    );
    const commandSuffix = COMMAND_SUFFIXES.some(suffix =>
      new RegExp(`^${escapeRegExp(suffix)}(?:\\s|$)`, "i").test(after)
    );

    if (!before || !after || beforeCue || afterCue || commandSuffix) {
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
      route: "none",
      previousTurn,
      turn: nextTurn
    };
  };

  const prepareHandoffToV1 = (turn = generation) => {
    if (!isCurrent(turn)) return null;
    state = V3_STATES.HANDOFF;
    monitoringTurn = null;
    return {
      route: "none",
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
