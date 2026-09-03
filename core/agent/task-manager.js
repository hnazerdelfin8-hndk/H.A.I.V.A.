// =========================================
// H.A.I.V.A. AGENT — TASK MANAGER
// =========================================

const TERMINAL_STATES = new Set(["completed", "failed", "blocked"]);
const VALID_STATES = new Set(["created", "planned", "ready", "running", "verifying", ...TERMINAL_STATES]);

function normalizeStep(step, index) {
  if (typeof step === "string") return { id: `step-${index + 1}`, description: step, status: "pending" };
  if (!step || typeof step !== "object") throw new Error("Invalid task step.");
  return {
    id: String(step.id || `step-${index + 1}`),
    description: String(step.description || step.name || "Unnamed step"),
    status: String(step.status || "pending"),
    action: step.action || null,
    result: step.result ?? null
  };
}

export function createTask(input, steps = []) {
  const goal = String(input || "").trim();
  if (!goal) throw new Error("Task goal is required.");

  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    goal,
    state: "created",
    steps: steps.map(normalizeStep),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    result: null,
    error: null
  };
}

export function setTaskState(task, state) {
  if (!task || typeof task !== "object") throw new Error("Task is required.");
  if (!VALID_STATES.has(state)) throw new Error(`Invalid task state: ${state}`);
  if (TERMINAL_STATES.has(task.state) && task.state !== state) {
    throw new Error(`Cannot transition terminal task from ${task.state} to ${state}.`);
  }
  task.state = state;
  task.updatedAt = new Date().toISOString();
  return task;
}

export function updateTaskStep(task, stepId, patch = {}) {
  const step = task?.steps?.find(item => item.id === stepId);
  if (!step) throw new Error(`Task step not found: ${stepId}`);
  Object.assign(step, patch);
  task.updatedAt = new Date().toISOString();
  return step;
}

export function isTerminal(task) {
  return TERMINAL_STATES.has(task?.state);
}

export function summarizeTask(task) {
  return {
    id: task.id,
    goal: task.goal,
    state: task.state,
    steps: task.steps.map(({ id, description, status }) => ({ id, description, status })),
    result: task.result,
    error: task.error
  };
}
