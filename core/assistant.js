// =========================================
// H.A.I.V.A. ASSISTANT CONTROLLER
// =========================================

import { CONFIG } from "./config.js";
import { routeRequest } from "./router.js";
import { setUIState } from "./ui-bridge.js";

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
