// =========================================
// H.A.I.V.A. REQUEST ROUTER
// =========================================

import { CONFIG } from "./config.js";
import { executeSkill, getSkills } from "./skill-manager.js";
import { getContext, remember } from "./memory.js";
import { detectIntent, prepareReasoning, decide } from "./brain/index.js";
import { orchestrate } from "./orchestrator/index.js";

export async function routeRequest(input) {
  if (!input) return { success: false, source: "router", response: "" };

  const message = String(input).trim();
  if (!message) return { success: false, source: "router", response: "" };

  console.log("H.A.I.V.A. Router:", message);

  const context = getContext();
  const intent = detectIntent(message);
  const reasoning = prepareReasoning(message, context);
  const decision = decide(intent, getSkills());

  console.log("H.A.I.V.A. Brain:", { intent, reasoning, decision });

  try {
    const skillResponse = await executeSkill(message, {
      intent,
      reasoning,
      decision,
      context
    });

    if (skillResponse !== null && skillResponse !== undefined && skillResponse !== "") {
      const response = String(skillResponse);
      remember("user", message);
      remember("assistant", response);
      return { success: true, source: "skill", response, intent: intent.name };
    }
  } catch (error) {
    console.error("Skill routing failed:", error);
  }

  if (!CONFIG.features.chat) {
    return { success: false, source: "router", response: CONFIG.assistant.fallbackResponse, intent: intent.name };
  }

  try {
    const result = await orchestrate({
      message,
      context,
      intent,
      reasoning,
      decision
    });

    remember("user", message);
    remember("assistant", result.response);

    return {
      success: true,
      source: result.source,
      response: result.response,
      intent: intent.name,
      orchestration: result.orchestration
    };
  } catch (error) {
    console.error("AI orchestration failed:", error);
    return { success: false, source: "error", response: CONFIG.assistant.connectionError, intent: intent.name };
  }
}
