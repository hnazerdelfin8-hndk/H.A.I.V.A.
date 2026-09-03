// =========================================
// H.A.I.V.A. AGENT — EXECUTION ENGINE
// =========================================

import { canExecute } from "./approval.js";
import { setTaskState, updateTaskStep } from "./task-manager.js";

export async function executeTask(task, { executor, approved = false } = {}) {
  if (!task) throw new Error("Task is required.");
  if (typeof executor !== "function") throw new Error("An executor function is required.");

  setTaskState(task, "running");

  try {
    for (const step of task.steps) {
      const action = step.action || { type: "controlled", description: step.description };
      if (!canExecute(action, { approved })) {
        setTaskState(task, "blocked");
        task.error = `Approval required for action: ${step.id}`;
        return task;
      }

      updateTaskStep(task, step.id, { status: "running" });
      try {
        const result = await executor(action, { task, step });
        updateTaskStep(task, step.id, { status: "completed", result });
      } catch (error) {
        updateTaskStep(task, step.id, { status: "failed", result: null });
        task.error = error instanceof Error ? error.message : String(error);
        setTaskState(task, "failed");
        return task;
      }
    }

    setTaskState(task, "verifying");
    return task;
  } catch (error) {
    task.error = error instanceof Error ? error.message : String(error);
    setTaskState(task, "failed");
    return task;
  }
}
