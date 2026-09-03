// =========================================
// H.A.I.V.A. STAGE 3B — TOOL ↔ INTEGRATION BRIDGE
// =========================================

function requireText(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function requireFunction(value, name) {
  if (typeof value !== "function") throw new Error(`${name} is required.`);
  return value;
}

const VALID_RISKS = new Set(["safe", "controlled", "approval"]);

export function createIntegrationTool({
  toolName,
  integrationName,
  description = "",
  risk,
  integrationManager,
  register = false,
  registerTool
} = {}) {
  const name = requireText(toolName, "Tool name").toLowerCase();
  const integration = requireText(integrationName, "Integration name").toLowerCase();
  requireFunction(integrationManager?.execute, "Integration manager");

  const toolRisk = risk || integrationManager.get?.(integration)?.risk || "controlled";
  if (!VALID_RISKS.has(toolRisk)) throw new Error(`Invalid risk level for tool: ${name}.`);

  const tool = {
    name,
    description: String(description).trim(),
    risk: toolRisk,
    execute: (input, context = {}) => integrationManager.execute(integration, input, {
      ...context,
      tool: name,
      risk: toolRisk
    })
  };

  if (register) {
    requireFunction(registerTool, "Tool registrar");
    registerTool(tool);
  }

  return tool;
}
