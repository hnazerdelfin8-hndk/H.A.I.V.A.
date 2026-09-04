const STATES = ["created","planning","ready","executing","verifying","completed","blocked","failed","retrying","escalated"];
export const VALID_INTELLIGENCE_STATES = new Set(STATES);

export function createGoalState(goal) {
  const value = String(goal ?? "").trim();
  if (!value) throw new Error("Goal is required.");
  return { goal: value, state: "created", currentStep: null, progress: 0, blockers: [], attempts: 0, history: [{ state: "created", at: new Date().toISOString() }] };
}

export function transitionGoalState(goalState, state, metadata = {}) {
  if (!goalState || !VALID_INTELLIGENCE_STATES.has(state)) throw new Error("Valid goal state is required.");
  goalState.state = state;
  if (metadata.currentStep !== undefined) goalState.currentStep = metadata.currentStep;
  if (metadata.progress !== undefined) goalState.progress = Math.max(0, Math.min(1, Number(metadata.progress)));
  if (metadata.blockers) goalState.blockers = [...metadata.blockers];
  if (state === "retrying") goalState.attempts += 1;
  goalState.history.push({ state, at: new Date().toISOString(), metadata: { ...metadata } });
  return goalState;
}

export function isGoalTerminal(goalState) { return ["completed","failed","blocked","escalated"].includes(goalState?.state); }
