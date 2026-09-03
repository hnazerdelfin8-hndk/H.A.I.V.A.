// =========================================
// H.A.I.V.A. AGENT — ORCHESTRATOR
// =========================================

import { createTask, setTaskState, summarizeTask } from "./task-manager.js";
import { executeTask } from "./execution-engine.js";

function defaultPlan(goal) {
  return [
    { id: "understand", description: `Understand goal: ${goal}`, action: { type: "analyze", goal } },
    { id: "plan", description: "Create an executable plan", action: { type: "plan", goal } }
  ];
}

export async function runAgent(goal, {
  planner = defaultPlan,
  executor = async () => null,
  verifier = async () => ({ passed: true }),
  approved = false
} = {}) {
  const task = createTask(goal);

  try {
    const plannedSteps = await planner(task.goal);
    if (!Array.isArray(plannedSteps) || plannedSteps.length === 0) {
      throw new Error("Planner returned no executable steps.");
    }

    task.steps = plannedSteps.map((step, index) => ({
      id: String(step.id || `step-${index + 1}`),
      description: String(step.description || step.name || `Step ${index + 1}`),
      status: "pending",
      action: step.action || null,
      result: null
    }));
    setTaskState(task, "planned");
    setTaskState(task, "ready");

    await executeTask(task, { executor, approved });
    if (task.state === "blocked" || task.state === "failed") return summarizeTask(task);

    const verification = await verifier(task);
    if (!verification?.passed) {
      task.error = verification?.error || "Verification failed.";
      setTaskState(task, "failed");
      return summarizeTask(task);
    }

    task.result = verification.result ?? verification;
    setTaskState(task, "completed");
    return summarizeTask(task);
  } catch (error) {
    task.error = error instanceof Error ? error.message : String(error);
    if (task.state !== "failed" && task.state !== "blocked") setTaskState(task, "failed");
    return summarizeTask(task);
  }
}
