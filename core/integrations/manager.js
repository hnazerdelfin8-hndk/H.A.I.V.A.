// =========================================
// H.A.I.V.A. STAGE 3 — TOOLS & INTEGRATIONS
// INTEGRATION MANAGER
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

export function createIntegrationManager({ integrations = [] } = {}) {
  if (!Array.isArray(integrations)) throw new Error("integrations must be an array.");
  const registry = new Map();

  function register(integration) {
    if (!integration || typeof integration !== "object") {
      throw new Error("Integration specification is required.");
    }
    const name = requireText(integration.name, "Integration name").toLowerCase();
    if (registry.has(name)) throw new Error(`Integration already registered: ${name}.`);
    const risk = integration.risk || "controlled";
    if (!VALID_RISKS.has(risk)) throw new Error(`Invalid risk level for integration: ${name}.`);
    if (typeof integration.execute !== "function") {
      throw new Error(`Integration executor is required: ${name}.`);
    }
    const registered = Object.freeze({
      name,
      description: String(integration.description || "").trim(),
      risk,
      execute: integration.execute,
      health: typeof integration.health === "function" ? integration.health : null
    });
    registry.set(name, registered);
    return { name: registered.name, description: registered.description, risk: registered.risk };
  }

  for (const integration of integrations) register(integration);

  function get(name) {
    return registry.get(requireText(name, "Integration name").toLowerCase()) || null;
  }

  function list() {
    return [...registry.values()].map(({ name, description, risk }) => ({ name, description, risk }));
  }

  async function check(name) {
    const integration = get(name);
    if (!integration) throw new Error(`Integration not found: ${String(name || "").trim().toLowerCase()}.`);
    if (!integration.health) return { name: integration.name, healthy: true, checked: false };
    const result = await integration.health();
    return { name: integration.name, healthy: result?.healthy === true, checked: true, detail: result };
  }

  async function execute(name, input, context = {}) {
    const integration = get(name);
    if (!integration) throw new Error(`Integration not found: ${String(name || "").trim().toLowerCase()}.`);
    return integration.execute(input, { ...context, integration: integration.name, risk: integration.risk });
  }

  return { register, get, list, check, execute };
}
