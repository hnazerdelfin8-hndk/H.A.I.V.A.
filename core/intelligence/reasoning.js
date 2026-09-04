const clean = (value) => String(value ?? "").trim();

export function createReasoningState(goal, context = {}, constraints = []) {
  const normalizedGoal = clean(goal);
  if (!normalizedGoal) throw new Error("Reasoning goal is required.");
  return {
    goal: normalizedGoal,
    context: context && typeof context === "object" ? { ...context } : {},
    constraints: Array.isArray(constraints) ? [...constraints] : [],
    subGoals: [],
    hypotheses: [],
    decisions: [],
    status: "initialized"
  };
}

export function decomposeGoal(state, splitter = null) {
  if (!state?.goal) throw new Error("Reasoning state is required.");
  const parts = typeof splitter === "function" ? splitter(state.goal, state.context) : [state.goal];
  state.subGoals = Array.isArray(parts) ? parts.map((item, index) => ({ id: `goal-${index + 1}`, description: clean(item) })).filter(item => item.description) : [];
  state.status = "decomposed";
  return state.subGoals.map(item => ({ ...item }));
}

export function assembleContext(state, memory = null, query = state?.goal) {
  if (!state) throw new Error("Reasoning state is required.");
  const memories = memory && typeof memory.recall === "function" ? memory.recall({ query, limit: 10 }) : [];
  state.context = { ...state.context, memories };
  state.status = "contextualized";
  return { ...state.context, memories: [...memories] };
}

export function evaluateConstraints(candidate, constraints = []) {
  const failures = constraints.filter(rule => typeof rule === "function" ? !rule(candidate) : false);
  return { allowed: failures.length === 0, failures };
}

export function finalizeReasoning(state, decision) {
  if (!state) throw new Error("Reasoning state is required.");
  state.decisions.push({ decision, at: new Date().toISOString() });
  state.status = "decided";
  return state;
}
