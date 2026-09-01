// =========================================
// H.A.I.V.A. REQUEST ROUTER
// =========================================

import { CONFIG } from "./config.js";
import { executeSkill, getSkills } from "./skill-manager.js";
import { getContext, remember } from "./memory.js";
import { detectIntent, prepareReasoning, decide } from "./brain/index.js";

export async function routeRequest(input) {
  if (!input) return { success: false, source: "router", response: "" };

  const message = String(input).trim();
  if (!message) return { success: false, source: "router", response: "" };

  console.log("H.A.I.V.A. Router:", message);

  // BRAIN: understand the request before choosing how to handle it.
  const context = getContext();
  const intent = detectIntent(message);
  const reasoning = prepareReasoning(message, context);
  const decision = decide(intent, getSkills());

  console.log("H.A.I.V.A. Brain:", { intent, reasoning, decision });

  // SKILLS: handle deterministic/local commands first.
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

  // AI: use the conversational brain when no local skill can answer.
  if (!CONFIG.features.chat) {
    return { success: false, source: "router", response: CONFIG.assistant.fallbackResponse, intent: intent.name };
  }

  try {
    const response = await fetch(CONFIG.api.chatEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: context,
        brain: {
          intent: intent.name,
          confidence: intent.confidence,
          referencesContext: reasoning.referencesContext,
          decision: decision.action
        }
      })
    });

    if (!response.ok) throw new Error(`AI server returned ${response.status}`);

    const data = await response.json();
    const answer = data.response || data.message;
    if (!answer) throw new Error("AI returned an empty response.");

    remember("user", message);
    remember("assistant", String(answer));

    return { success: true, source: "ai", response: String(answer), intent: intent.name };
  } catch (error) {
    console.error("AI request failed:", error);
    return { success: false, source: "error", response: CONFIG.assistant.connectionError, intent: intent.name };
  }
}
