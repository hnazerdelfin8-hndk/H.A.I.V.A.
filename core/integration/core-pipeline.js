// =========================================
// H.A.I.V.A. PHASE 8 — CORE INTEGRATION PIPELINE
// =========================================

import { createTask, setTaskState, summarizeTask } from "../agent/task-manager.js";

export function createCorePipeline({ agent, executor, verifier, diagnostics, memory } = {}) {
  if (!agent || typeof agent !== "object") throw new Error("Agent is required.");
  if (!executor || typeof executor.execute !== "function") throw new Error("Executor is required.");
  if (!verifier || typeof verifier.verify !== "function") throw new Error("Verifier is required.");
  if (!diagnostics || typeof diagnostics.diagnose !== "function") throw new Error("Diagnostics are required.");
  if (!memory || typeof memory.remember !== "function") throw new Error("Memory is required.");

  return {
    async run(goal, options = {}) {
      const task = createTask(goal, options.steps || []);
      setTaskState(task, "planned");
      memory.remember("task", task.goal, { taskId: task.id, state: task.state });

      setTaskState(task, "ready");
      const execution = await executor.execute(task, options.execution || {});
      task.result = execution;
      setTaskState(task, "verifying");

      const verification = await verifier.verify(task, execution);
      if (verification?.passed) {
        setTaskState(task, "completed");
        memory.remember("decision", "Task verification passed", {
          taskId: task.id,
          verification
        });
        return { ok: true, task: summarizeTask(task), verification };
      }

      const diagnosis = await diagnostics.diagnose(task, verification);
      setTaskState(task, "failed");
      task.error = diagnosis;
      memory.remember("decision", "Task verification failed and was diagnosed", {
        taskId: task.id,
        diagnosis
      });
      return { ok: false, task: summarizeTask(task), verification, diagnosis };
    }
  };
}
