// =========================================
// H.A.I.V.A. AI ORCHESTRATOR
// Layer 3: Router + AI Orchestrator
// =========================================

import { CONFIG } from "../config.js";

// Remote AI must never block the voice/chat pipeline indefinitely.
const DEFAULT_MAX_RETRIES = 0;
const AI_REQUEST_TIMEOUT_MS = 8000;

function analyzeTask(message, intent = {}) {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();
  const complexity = text.length > 240 || /\b(plan|research|analyze|compare|build|create|automate|workflow|steps)\b/i.test(text)
    ? "complex"
    : "simple";

  return {
    type: intent.name || "unknown",
    complexity,
    requiresPlanning: complexity === "complex",
    requiresExternalAI: true,
    requiresTools: /\b(search|research|weather|email|calendar|file|automation)\b/i.test(lower)
  };
}

function planTask(message, analysis) {
  return analysis.requiresPlanning
    ? ["understand objective", "execute with selected AI/tool", "evaluate result", "refine if needed"]
    : ["execute with selected AI/tool", "evaluate result"];
}

function generatePrompt(message, context = {}, analysis = {}) {
  return {
    message: String(message).trim(),
    context,
    task: analysis,
    instructions: [
      "Answer the user's request directly.",
      "Use the supplied context only when relevant.",
      "Do not claim actions or facts that were not actually performed or verified.",
      "Prefer concise, useful, natural responses appropriate for H.A.I.V.A."
    ]
  };
}

function optimizePrompt(prompt) {
  return {
    ...prompt,
    instructions: [...prompt.instructions, "Return the best complete answer for the current task."]
  };
}

function selectAgent(analysis) {
  if (analysis.requiresTools) return "tool-aware-general-agent";
  if (analysis.complexity === "complex") return "reasoning-agent";
  return "general-agent";
}

function routeTool(analysis) {
  if (!analysis.requiresTools) return null;
  return "api-tools";
}

async function executeAI(prompt) {
  if (!CONFIG.features.chat) throw new Error("Chat feature is disabled.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG.api.chatEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt.message,
        history: prompt.context,
        brain: {
          intent: prompt.task.type,
          complexity: prompt.task.complexity,
          orchestrated: true,
          agent: prompt.agent,
          tool: prompt.tool
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`AI server returned ${response.status}`);

    const data = await response.json();
    const answer = data.response || data.message;
    if (!answer) throw new Error("AI returned an empty response.");

    return String(answer);
  } finally {
    clearTimeout(timeout);
  }
}

function evaluateResult(result) {
  const text = String(result || "").trim();
  return {
    passed: text.length > 0,
    reason: text.length > 0 ? "non-empty result" : "empty result"
  };
}

export async function orchestrate({ message, context = [], intent = {}, reasoning = {}, decision = {} } = {}) {
  const task = analyzeTask(message, intent);
  const plan = planTask(message, task);
  const generatedPrompt = generatePrompt(message, { context, reasoning, decision }, task);
  const prompt = optimizePrompt(generatedPrompt);
  const agent = selectAgent(task);
  const tool = routeTool(task);

  prompt.agent = agent;
  prompt.tool = tool;

  let lastError = null;

  for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt += 1) {
    try {
      const result = await executeAI(prompt);
      const evaluation = evaluateResult(result);

      if (evaluation.passed) {
        return {
          success: true,
          source: "orchestrator",
          response: result,
          orchestration: {
            task,
            plan,
            agent,
            tool,
            attempt: attempt + 1,
            evaluation
          }
        };
      }

      lastError = new Error(evaluation.reason);
    } catch (error) {
      lastError = error;
      console.error(`H.A.I.V.A. Orchestrator attempt ${attempt + 1} failed:`, error);
    }
  }

  throw lastError || new Error("Orchestrator execution failed.");
}
