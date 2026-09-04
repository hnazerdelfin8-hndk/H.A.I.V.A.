const clone = value => structuredClone(value);

export function createAgentRegistry(initial = []) {
  const agents = new Map(initial.map(agent => [agent.id, { ...agent, capabilities: [...(agent.capabilities ?? [])], status: agent.status ?? "active" }]));
  return {
    register(agent) { if (!agent?.id) throw new Error("Agent id is required."); agents.set(agent.id, { ...agent, capabilities: [...(agent.capabilities ?? [])], status: agent.status ?? "active" }); return clone(agents.get(agent.id)); },
    get(id) { return clone(agents.get(id) ?? null); },
    list() { return clone([...agents.values()]); },
    select(capability) { return clone([...agents.values()].filter(a => a.status === "active" && a.capabilities.includes(capability)).sort((a,b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null); }
  };
}

export function matchAgents(registry, capabilities = []) {
  return registry.list().filter(agent => agent.status === "active").map(agent => ({ ...agent, match: capabilities.filter(c => agent.capabilities.includes(c)).length / Math.max(capabilities.length, 1) })).sort((a,b) => b.match - a.match || (b.score ?? 0) - (a.score ?? 0));
}

export function delegateTask(registry, task) {
  const candidates = matchAgents(registry, task.capabilities ?? []);
  if (!candidates.length || candidates[0].match === 0) throw new Error("No capable agent available.");
  return { task: clone(task), agent: candidates[0] };
}

export function coordinateTasks(registry, tasks) {
  return tasks.map(task => delegateTask(registry, task));
}

export function recordAgentOutcome(registry, agentId, outcome) {
  const agent = registry.get(agentId); if (!agent) throw new Error("Unknown agent.");
  const success = Boolean(outcome?.success); const score = Math.max(0, Math.min(1, ((agent.score ?? 0.5) + (success ? 0.1 : -0.1))));
  return registry.register({ ...agent, score, lastOutcome: success ? "success" : "failure" });
}

export function createAgentMemory() {
  const entries = new Map();
  return { remember(key, value) { entries.set(key, clone(value)); }, recall(key) { return clone(entries.get(key) ?? null); }, snapshot() { return clone(Object.fromEntries(entries)); }, clear() { entries.clear(); } };
}

export function transitionAgent(agent, status) {
  const allowed = new Set(["active", "paused", "retired", "recovering"]); if (!allowed.has(status)) throw new Error("Invalid agent lifecycle state.");
  if (agent.status === "retired" && status !== "recovering") throw new Error("Retired agent must recover before activation.");
  return { ...clone(agent), status };
}
