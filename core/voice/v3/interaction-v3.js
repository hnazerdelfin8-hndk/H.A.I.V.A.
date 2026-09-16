// =========================================
// H.A.I.V.A. VOICE INTERACTION V3
// =========================================
// V3 owns interruption state only.
// IMPORTANT: V3 does NOT open a second SpeechRecognizer/microphone while
// H.A.I.V.A. is speaking. Native Android must provide a duplex/low-level
// interrupt signal for true voice barge-in.
// V3 accepts that signal and routes the candidate through V4.

export const V3_STATES = Object.freeze({
  IDLE: "IDLE",
  ARMED: "ARMED",
  COMMITTED: "COMMITTED"
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

  // Monitoring means V3 is logically armed for an interrupt signal.
  // It MUST NOT imply that V3 owns the Android SpeechRecognizer microphone.
  const beginMonitoring = (turn = generation) => {
    if (turn !== generation) return false;
    monitoringTurn = turn;
    state = V3_STATES.ARMED;
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
  const isMonitoring = turn => state === V3_STATES.ARMED && monitoringTurn === turn;
  const isCurrent = turn => turn === generation;

  const commitCapture = (turn, text) => {
    if (!isMonitoring(turn) || committed) return null;
    const value = String(text ?? "").trim();
    if (!value) return null;
    committed = true;
    state = V3_STATES.COMMITTED;
    return Object.freeze({ turn, text: value, source: "v3" });
  };

  const releaseCapture = (turn = generation) => {
    if (!isCurrent(turn)) return false;
    committed = false;
    if (monitoringTurn === turn) state = V3_STATES.ARMED;
    return true;
  };

  return Object.freeze({
    beginTurn,
    beginMonitoring,
    stopMonitoring,
    getState,
    isMonitoring,
    isCurrent,
    commitCapture,
    releaseCapture
  });
}
