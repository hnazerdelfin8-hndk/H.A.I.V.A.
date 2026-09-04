const text = (value) => String(value ?? "").trim();

export function createPlan(goal, steps = []) {
  const normalizedGoal = text(goal);
  if (!normalizedGoal) throw new Error("Plan goal is required.");
  if (!Array.isArray(steps) || !steps.length) throw new Error("Plan requires executable steps.");
  return {
    goal: normalizedGoal,
    steps: steps.map((step, index) => ({ id: String(step.id || `step-${index + 1}`), description: text(step.description || step), dependencies: Array.isArray(step.dependencies) ? [...step.dependencies] : [], status: "pending", action: step.action || null })),
    status: "ready"
  };
}

export function nextReadyStep(plan) {
  if (!plan?.steps) throw new Error("Plan is required.");
  return plan.steps.find(step => step.status === "pending" && step.dependencies.every(id => plan.steps.some(dep => dep.id === id && dep.status === "completed"))) || null;
}

export function updatePlanStep(plan, id, patch = {}) {
  const step = plan?.steps?.find(item => item.id === id);
  if (!step) throw new Error(`Plan step not found: ${id}`);
  Object.assign(step, patch);
  return { ...step };
}

export function isPlanComplete(plan) { return Boolean(plan?.steps?.length) && plan.steps.every(step => step.status === "completed"); }
