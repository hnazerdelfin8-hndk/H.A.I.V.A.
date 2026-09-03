// =========================================
// H.A.I.V.A. TOOL REGISTRY
// =========================================

const tools = new Map();

const VALID_RISKS = new Set(["safe", "controlled", "approval"]);

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function validateTool(tool) {
  if (!tool || typeof tool !== "object") {
    throw new Error("Invalid tool definition.");
  }

  const name = normalizeName(tool.name);
  if (!name) throw new Error("Tool name is required.");
  if (typeof tool.execute !== "function") {
    throw new Error(`Tool "${name}" must provide an execute function.`);
  }

  const risk = tool.risk || "controlled";
  if (!VALID_RISKS.has(risk)) {
    throw new Error(`Invalid risk level for tool "${name}".`);
  }

  return {
    name,
    description: String(tool.description || "").trim(),
    risk,
    input: tool.input || null,
    execute: tool.execute
  };
}

export function registerTool(tool) {
  const normalized = validateTool(tool);
  if (tools.has(normalized.name)) {
    throw new Error(`Tool "${normalized.name}" is already registered.`);
  }
  tools.set(normalized.name, normalized);
  return normalized;
}

export function getTool(name) {
  return tools.get(normalizeName(name)) || null;
}

export function hasTool(name) {
  return tools.has(normalizeName(name));
}

export function listTools() {
  return Array.from(tools.values()).map(({ execute, ...metadata }) => ({ ...metadata }));
}

export function unregisterTool(name) {
  return tools.delete(normalizeName(name));
}

export async function executeTool(name, input, context = {}) {
  const tool = getTool(name);
  if (!tool) throw new Error(`Tool "${normalizeName(name)}" is not registered.`);
  return tool.execute(input, context);
}

export function clearTools() {
  tools.clear();
}
