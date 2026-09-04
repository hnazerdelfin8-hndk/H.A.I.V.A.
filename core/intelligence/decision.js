export function scoreAction(action, { priority = 0.5, confidence = 0.5, risk = 0.5 } = {}) {
  const base = Number(action?.score ?? 0.5);
  const value = base * 0.4 + Number(priority) * 0.25 + Number(confidence) * 0.25 - Number(risk) * 0.1;
  return Math.max(0, Math.min(1, value));
}

export function chooseAction(actions = [], context = {}) {
  if (!Array.isArray(actions) || !actions.length) throw new Error("At least one candidate action is required.");
  const ranked = actions.map((action, index) => ({ action, index, score: scoreAction(action, context) })).sort((a, b) => b.score - a.score || a.index - b.index);
  return { ...ranked[0], candidates: ranked.map(item => ({ action: item.action, score: item.score })) };
}

export function isActionAllowed(action, constraints = []) {
  return constraints.every(rule => typeof rule !== "function" || rule(action));
}
