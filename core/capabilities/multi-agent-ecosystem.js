// =========================================
// H.A.I.V.A. STAGE 2 — PHASE C
// MULTI-AGENT ECOSYSTEM
// =========================================

function requireText(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function requireFunction(value, name) {
  if (typeof value !== "function") throw new Error(`${name} is required.`);
  return value;
}

export function createMultiAgentEcosystem({ agents = [], coordinator } = {}) {
  if (!Array.isArray(agents)) throw new Error("agents must be an array.");
  requireFunction(coordinator, "Coordinator");

  const registry = new Map();
  for (const agent of agents) register(agent);

  function register(agent) {
    if (!agent || typeof agent !== "object") throw new Error("Agent specification is required.");
    const name = requireText(agent.name, "Agent name").toLowerCase();
    if (registry.has(name)) throw new Error(`Agent already registered: ${name}.`);
    if (typeof agent.run !== "function") throw new Error(`Agent runner is required: ${name}.`);
    registry.set(name, Object.freeze({ ...agent, name }));
    return registry.get(name);
  }

  function get(name) {
    return registry.get(requireText(name, "Agent name").toLowerCase()) || null;
  }

  function list() {
    return [...registry.values()].map(({ name, role = "custom" }) => ({ name, role }));
  }

  async function run(goal, { assignments = [], maxAgents = 10 } = {}) {
    const normalizedGoal = requireText(goal, "Goal");
    if (!Array.isArray(assignments) || assignments.length === 0) throw new Error("At least one agent assignment is required.");
    if (assignments.length > maxAgents) throw new Error(`Team exceeds maximum agent limit: ${maxAgents}.`);

    const normalizedAssignments = assignments.map((assignment, index) => {
      if (!assignment || typeof assignment !== "object") throw new Error(`Invalid assignment: ${index + 1}.`);
      const agent = get(assignment.agent);
      if (!agent) throw new Error(`Agent not found: ${assignment.agent}.`);
      return {
        id: String(assignment.id || `${agent.name}-${index + 1}`),
        agent,
        objective: requireText(assignment.objective || normalizedGoal, `Assignment ${index + 1} objective`),
        dependsOn: Array.isArray(assignment.dependsOn) ? assignment.dependsOn.map(String) : []
      };
    });

    const ids = new Set(normalizedAssignments.map(item => item.id));
    for (const assignment of normalizedAssignments) {
      for (const dependency of assignment.dependsOn) {
        if (!ids.has(dependency)) throw new Error(`Unknown assignment dependency: ${dependency}.`);
        if (dependency === assignment.id) throw new Error(`Assignment cannot depend on itself: ${assignment.id}.`);
      }
    }

    const completed = new Map();
    const pending = [...normalizedAssignments];
    while (pending.length) {
      const ready = pending.filter(item => item.dependsOn.every(dep => completed.has(dep)));
      if (!ready.length) throw new Error("Multi-agent dependency graph cannot make further progress.");
      const results = await Promise.all(ready.map(async assignment => {
        const dependencyResults = Object.fromEntries(assignment.dependsOn.map(dep => [dep, completed.get(dep)]));
        const result = await assignment.agent.run(assignment.objective, { goal: normalizedGoal, assignment, dependencyResults });
        return { id: assignment.id, agent: assignment.agent.name, result };
      }));
      for (const result of results) {
        completed.set(result.id, result);
        pending.splice(pending.findIndex(item => item.id === result.id), 1);
      }
    }

    const outputs = [...completed.values()];
    const coordinated = await coordinator(normalizedGoal, outputs);
    return { version: "1.0", type: "multi-agent-result", goal: normalizedGoal, agents: outputs, result: coordinated };
  }

  return { register, get, list, run };
}
