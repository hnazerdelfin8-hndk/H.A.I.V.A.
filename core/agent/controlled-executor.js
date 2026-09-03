// =========================================
// H.A.I.V.A. CONTROLLED EXECUTOR
// =========================================

import { canExecute } from "./approval.js";
import { executeTool, getTool } from "../tools/registry.js";

/**
 * Execute a registered tool through the agent safety boundary.
 *
 * The generic approval policy keeps `controlled` actions available to the
 * task engine, but this executor is the explicit boundary for tool execution:
 * both controlled and approval-risk tools require an explicit approval flag.
 * Safe tools remain autonomous.
 */
export async function executeRegisteredTool(name, input, {
  approved = false,
  context = {}
} = {}) {
  const tool = getTool(name);
  if (!tool) throw new Error(`Tool \"${String(name || \"\").trim().toLowerCase()}\" is not registered.`);

  const action = {
    type: tool.risk,
    tool: tool.name,
    input
  };

  const approvalRequired = tool.risk === "controlled" || tool.risk === "approval";
  if (approvalRequired && approved !== true) {
    throw new Error(`Approval required for tool: ${tool.name}`);
  }

  if (!canExecute(action, { approved })) {
    throw new Error(`Approval required for tool: ${tool.name}`);
  }

  return executeTool(tool.name, input, {
    ...context,
    action,
    tool: tool.name
  });
}

/**
 * Build an executor compatible with executeTask/runAgent.
 */
export function createControlledExecutor({ approved = false, context = {} } = {}) {
  return async (action, executionContext = {}) => {
    if (!action || typeof action !== "object") {
      throw new Error("Execution action is required.");
    }

    const toolName = action.tool || action.name;
    if (!toolName) {
      throw new Error("Execution action must specify a tool.");
    }

    return executeRegisteredTool(toolName, action.input, {
      approved,
      context: { ...context, ...executionContext }
    });
  };
}
