// =========================================
// H.A.I.V.A. STAGE 2 — PHASE B
// AUTONOMOUS TASK ENGINE
// =========================================

import { canExecute } from "../agent/approval.js";
import { createTask, setTaskState, updateTaskStep, summarizeTask } from "../agent/task-manager.js";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_STEPS = 100;

function requireFunction(value, name) {
  if (typeof value !== "function") throw new Error(`${name} is required.`);
  return value;
}

function normalizeSteps(steps, maxSteps) {
  if (!Array.isArray(steps) || steps.length === 0) throw new Error("Planner returned no executable steps.");
  if (steps.length > maxSteps) throw new Error(`Task exceeds maximum step limit: ${maxSteps}.`);

  const ids = new Set();
  return steps.map((step, index) => {
    if (!step || typeof step !== "object") throw new Error(`Invalid task step: ${index + 1}.`);
    const id = String(step.id || `step-${index + 1}`).trim();
    if (!id) throw new Error(`Task step ${index + 1} requires an id.`);
    if (ids.has(id)) throw new Error(`Duplicate task step id: ${id}.`);
    ids.add(id);

    const dependsOn = step.dependsOn == null ? [] : step.dependsOn;
    if (!Array.isArray(dependsOn)) throw new Error(`dependsOn must be an array for step: ${id}.`);

    return {
      id,
      description: String(step.description || step.name || `Step ${index + 1}`),
      status: "pending",
      action: step.action || null,
      result: null,
      dependsOn: dependsOn.map(value => String(value).trim()).filter(Boolean),
      attempts: 0,
      diagnostics: []
    };
  }).map(step => {
    for (const dependency of step.dependsOn) {
      if (dependency === step.id) throw new Error(`Task step cannot depend on itself: ${step.id}.`);
      if (!ids.has(dependency)) throw new Error(`Unknown task dependency: ${dependency}.`);
    }
    return step;
  });
}

function dependenciesCompleted(task, step) {
  return step.dependsOn.every(dependency =>
    task.steps.find(candidate => candidate.id === dependency)?.status === "completed"
  );
}

function dependencyFailure(task, step) {
  return step.dependsOn.some(dependency => {
    const candidate = task.steps.find(item => item.id === dependency);
    return candidate?.status === "failed" || candidate?.status === "blocked";
  });
}

export function createAutonomousTaskEngine({ planner, executor, verifier, diagnostics } = {}) {
  requireFunction(planner, "Planner");
  requireFunction(executor, "Executor");
  requireFunction(verifier, "Verifier");
  requireFunction(diagnostics, "Diagnostics");

  return {
    async run(goal, {
      approved = false,
      maxAttempts = DEFAULT_MAX_ATTEMPTS,
      maxSteps = DEFAULT_MAX_STEPS
    } = {}) {
      const task = createTask(goal);
      const safeMaxAttempts = Math.max(1, Math.min(Number(maxAttempts) || DEFAULT_MAX_ATTEMPTS, 10));
      const safeMaxSteps = Math.max(1, Math.min(Number(maxSteps) || DEFAULT_MAX_STEPS, DEFAULT_MAX_STEPS));

      try {
        const planned = await planner(task.goal, { task });
        task.steps = normalizeSteps(planned, safeMaxSteps);
        setTaskState(task, "planned");
        setTaskState(task, "ready");

        let completedCount = 0;
        while (completedCount < task.steps.length) {
          const readySteps = task.steps.filter(step => step.status === "pending" && dependenciesCompleted(task, step));

          if (readySteps.length === 0) {
            const blockedByFailure = task.steps.find(step => step.status === "pending" && dependencyFailure(task, step));
            task.error = blockedByFailure
              ? `Dependency failed for step: ${blockedByFailure.id}`
              : "Task dependency graph cannot make further progress.";
            setTaskState(task, "failed");
            return summarizeTask(task);
          }

          for (const step of readySteps) {
            if (!canExecute(step.action || { type: "controlled" }, { approved })) {
              task.error = `Approval required for action: ${step.id}`;
              setTaskState(task, "blocked");
              return summarizeTask(task);
            }

            let succeeded = false;
            for (let attempt = 1; attempt <= safeMaxAttempts; attempt += 1) {
              updateTaskStep(task, step.id, { status: "running", attempts: attempt });
              try {
                const result = await executor(step.action, { task, step, attempt });
                const verification = await verifier(result, { task, step, attempt });
                if (!verification?.passed) {
                  throw new Error(verification?.error || "Step verification failed.");
                }

                updateTaskStep(task, step.id, {
                  status: "completed",
                  result: verification.result ?? result,
                  diagnostics: step.diagnostics
                });
                completedCount += 1;
                succeeded = true;
                break;
              } catch (error) {
                const diagnosis = await diagnostics(error, { task, step, attempt });
                step.diagnostics.push(diagnosis);
                if (!diagnosis?.retryable || attempt >= safeMaxAttempts) {
                  updateTaskStep(task, step.id, { status: "failed", result: null, diagnostics: step.diagnostics });
                  task.error = diagnosis?.error || (error instanceof Error ? error.message : String(error));
                  setTaskState(task, "failed");
                  return summarizeTask(task);
                }
              }
            }

            if (!succeeded) {
              task.error = `Step failed without a terminal diagnosis: ${step.id}`;
              setTaskState(task, "failed");
              return summarizeTask(task);
            }
          }
        }

        const finalVerification = await verifier(task, { final: true });
        if (!finalVerification?.passed) {
          task.error = finalVerification?.error || "Final task verification failed.";
          setTaskState(task, "failed");
          return summarizeTask(task);
        }

        task.result = finalVerification.result ?? "Task completed and verified.";
        setTaskState(task, "verifying");
        setTaskState(task, "completed");
        return summarizeTask(task);
      } catch (error) {
        task.error = error instanceof Error ? error.message : String(error);
        if (task.state !== "blocked" && task.state !== "failed") setTaskState(task, "failed");
        return summarizeTask(task);
      }
    }
  };
}
