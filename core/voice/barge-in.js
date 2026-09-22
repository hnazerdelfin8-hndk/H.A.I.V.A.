export const BARGE_IN_STATES = Object.freeze({
  IDLE: "IDLE",
  ARMED: "ARMED",
  CAPTURING: "CAPTURING",
  COMMITTED: "COMMITTED"
});

export function createBargeInCoordinator() {
  let generation = 0;
  let state = BARGE_IN_STATES.IDLE;
  let monitoringTurn = null;
  let committed = false;

  const beginTurn = () => {
    generation += 1;
    committed = false;
    state = BARGE_IN_STATES.IDLE;
    monitoringTurn = null;
    return generation;
  };

  const beginMonitoring = (turn = generation) => {
    if (turn !== generation) return false;
    monitoringTurn = turn;
    state = BARGE_IN_STATES.ARMED;
    committed = false;
    return true;
  };

  const beginCapture = (turn = generation) => {
    if (monitoringTurn !== turn || turn !== generation || state !== BARGE_IN_STATES.ARMED) return false;
    state = BARGE_IN_STATES.CAPTURING;
    committed = false;
    return true;
  };

  const stopMonitoring = (turn = generation) => {
    if (monitoringTurn !== null && turn !== monitoringTurn) return false;
    monitoringTurn = null;
    state = BARGE_IN_STATES.IDLE;
    committed = false;
    return true;
  };

  const getState = () => state;
  const isMonitoring = turn =>
    (state === BARGE_IN_STATES.ARMED || state === BARGE_IN_STATES.CAPTURING) &&
    monitoringTurn === turn;

  const isCurrent = turn => turn === generation;

  const commitCapture = (turn, text) => {
    if (!isMonitoring(turn) || state !== BARGE_IN_STATES.CAPTURING || committed) return null;
    const value = String(text ?? "").trim();
    if (!value) return null;
    committed = true;
    state = BARGE_IN_STATES.COMMITTED;
    return Object.freeze({ turn, text: value, source: "barge-in" });
  };

  const releaseCapture = (turn = generation) => {
    if (!isCurrent(turn)) return false;
    committed = false;
    if (monitoringTurn === turn) state = BARGE_IN_STATES.ARMED;
    return true;
  };

  return Object.freeze({
    beginTurn,
    beginMonitoring,
    beginCapture,
    stopMonitoring,
    getState,
    isMonitoring,
    isCurrent,
    commitCapture,
    releaseCapture
  });
}
