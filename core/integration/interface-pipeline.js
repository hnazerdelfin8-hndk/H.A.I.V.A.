// =========================================
// H.A.I.V.A. PHASE 9 — INTERFACE → CORE ADAPTER
// =========================================

import { createCorePipeline } from "./core-pipeline.js";
import { createMemoryStore } from "../memory/project-memory.js";
import { routeRequest } from "../router.js";

/**
 * Route an interface request through the Phase 8 core pipeline while
 * preserving the existing router as the current execution backend.
 *
 * This is intentionally an adapter layer: voice/UI now enters the core
 * contract first, while the legacy router remains intact until deeper
 * agent/brain routing is verified in a later phase.
 */
export function createInterfacePipeline({ request = routeRequest, memory = createMemoryStore() } = {}) {
  if (typeof request !== "function") throw new Error("Interface request handler is required.");

  const core = createCorePipeline({
    agent: { name: "interface-agent" },
    executor: {
      async execute(task) {
        return request(task.goal);
      }
    },
    verifier: {
      async verify(task, execution) {
        return {
          passed: Boolean(execution?.success && execution?.response),
          evidence: {
            source: "interface-adapter",
            taskId: task.id,
            responsePresent: Boolean(execution?.response)
          },
          result: execution
        };
      }
    },
    diagnostics: {
      async diagnose(task, verification) {
        return {
          category: "interface_execution",
          taskId: task.id,
          verification
        };
      }
    },
    memory
  });

  return {
    run(input, options = {}) {
      return core.run(input, {
        ...options,
        steps: options.steps || [
          { id: "interface-request", description: "Process interface request through HAIVA Core" }
        ]
      });
    },
    memory
  };
}

export const interfacePipeline = createInterfacePipeline();

/**
 * Public interface entry point used by the voice/UI assistant.
 * Returns the legacy router execution result after it has passed through
 * the core integration contract.
 */
export async function runInterfaceRequest(input, options = {}) {
  const result = await interfacePipeline.run(input, options);
  if (!result.ok) {
    throw new Error("HAIVA Core interface verification failed.");
  }
  return result.task.result;
}
