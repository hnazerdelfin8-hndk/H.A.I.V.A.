// =========================================
// H.A.I.V.A. ASSISTANT CONTROLLER
// =========================================

import { CONFIG } from "./config.js";
import { routeRequest } from "./router.js";
import { setUIState } from "./ui-bridge.js";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getBasicResponse(command) {
  const text = normalize(command);
  if (!text) return null;

  if (/^(hello|hi|hey|hello haiva|hi haiva|hey haiva|yo haiva)$/i.test(text)) {
    return CONFIG.assistant.defaultGreeting;
  }

  if (/^(kumusta|kumusta ka|kamusta|kamusta ka|how are you)$/i.test(text)) {
    return "I'm doing well, Master. H.A.I.V.A. is online and ready.";
  }

  if (/^(anong pangalan mo|ano pangalan mo|sino ka|what is your name|whats your name)$/i.test(text)) {
    return "I'm H.A.I.V.A., your personal AI assistant, Master.";
  }

  return null;
}

export class HAIVAAssistant {
  constructor() {
    this.processing = false;
  }

  async respond(command) {
    if (this.processing) return null;

    const text = String(command || "").trim();
    if (!text) return null;

    this.processing = true;

    try {
      setUIState("THINKING");

      // Basic interaction stays available even when the AI backend
      // is not configured yet. Advanced requests use the Core Router.
      const basicResponse = getBasicResponse(text);
      if (basicResponse) return basicResponse;

      const result = await routeRequest(text);
      if (!result || !result.response) {
        throw new Error("No response received.");
      }

      return String(result.response).trim();
    } catch (error) {
      console.error("Assistant response failed:", error);
      return CONFIG.assistant.fallbackResponse;
    } finally {
      this.processing = false;
    }
  }
}
