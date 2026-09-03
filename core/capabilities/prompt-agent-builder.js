// =========================================
// H.A.I.V.A. STAGE 2 — PHASE A
// PROMPT & AGENT BUILDER
// =========================================

const ROLES = new Set(["researcher", "coder", "analyst", "creative", "operator", "custom"]);
const OUTPUTS = new Set(["text", "json", "code", "plan", "report"]);

function requireText(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function normalizeList(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("constraints must be an array.");
  return value.map((item, index) => requireText(item, `constraints[${index}]`));
}

export function createPromptAgentBuilder() {
  return {
    buildPrompt({ goal, role = "custom", context = "", constraints = [], output = "text" } = {}) {
      const normalizedGoal = requireText(goal, "Goal");
      if (!ROLES.has(role)) throw new Error(`Unsupported role: ${role}.`);
      if (!OUTPUTS.has(output)) throw new Error(`Unsupported output: ${output}.`);

      const normalizedContext = typeof context === "string" ? context.trim() : "";
      const normalizedConstraints = normalizeList(constraints);

      return {
        version: "1.0",
        type: "prompt-specification",
        role,
        goal: normalizedGoal,
        context: normalizedContext,
        constraints: normalizedConstraints,
        output,
        instructions: [
          `Act as a ${role} agent.`,
          `Achieve this goal: ${normalizedGoal}.`,
          ...(normalizedContext ? [`Use this context: ${normalizedContext}.`] : []),
          ...(normalizedConstraints.length ? [`Respect these constraints: ${normalizedConstraints.join("; ")}.`] : []),
          `Return the result as ${output}.`
        ]
      };
    },

    buildAgent({ name, goal, role = "custom", tools = [], constraints = [], output = "text" } = {}) {
      const normalizedName = requireText(name, "Agent name");
      if (!Array.isArray(tools)) throw new Error("tools must be an array.");
      const prompt = this.buildPrompt({ goal, role, constraints, output });
      return {
        version: "1.0",
        type: "agent-specification",
        name: normalizedName,
        role: prompt.role,
        goal: prompt.goal,
        tools: tools.map((tool, index) => requireText(tool, `tools[${index}]`)),
        constraints: prompt.constraints,
        output: prompt.output,
        prompt
      };
    }
  };
}
