// =========================================
// H.A.I.V.A. VOICE INTERACTION V3
// =========================================
// V3 is the interruption/barge-in capture mechanism during SPEAKING.
// It does not interpret speech, decide intent, parse commands, own TTS,
// control V1, or decide conversation state. The Brain owns meaning.

export const V3_STATES = Object.freeze({
  IDLE: "IDLE",
  MONITORING: "MONITORING"
});

export function createVoiceInteractionV3() {
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

  // V3 only commits the raw capture once for the active speaking turn.
  // Semantic classification is deliberately outside this module.
  const commitCapture = (turn, text) => {
    if (!isCurrent(turn) || committed) return null;
    const value = String(text ?? "").trim();
    if (!value) return null;
    committed = true;
    return Object.freeze({ turn, text: value, source: "v3" });
  };

  return Object.freeze({
    beginTurn,
    beginMonitoring,
    stopMonitoring,
    getState,
    isMonitoring,
    isCurrent,
    commitCapture
  });
}
