// =========================================
// H.A.I.V.A. ASSISTANT CONTROLLER
// =========================================

import { CONFIG } from "./config.js";
import { runInterfaceRequest } from "./integration/interface-pipeline.js";
import { setUIState, speak } from "./ui-bridge.js";

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

      // Phase 9: voice/UI requests enter the HAIVA Core pipeline first.
      const result = await runInterfaceRequest(text);
      if (!result || !result.response) {
        throw new Error("No response received.");
      }

      const response = String(result.response).trim();
      setUIState("SPEAKING");

      // Keep the spoken response alive until speech synthesis finishes.
      await speak(response);
      return response;
    } catch (error) {
      console.error("Assistant response failed:", error);

      const fallback = CONFIG.assistant.fallbackResponse;
      setUIState("SPEAKING");
      await speak(fallback);
      return fallback;
    } finally {
      this.processing = false;
    }
  }
}
