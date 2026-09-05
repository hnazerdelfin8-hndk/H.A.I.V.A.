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

  if (/^(hello|hi|hey|hello haiva|hi haiva|hey haiva|yo haiva|haiva)$/i.test(text)) {
    return CONFIG.assistant.defaultGreeting;
  }

  if (/^(kumusta|kumusta ka|kamusta|kamusta ka|how are you)$/i.test(text)) {
    return "I'm doing well, Master. H.A.I.V.A. is online and ready.";
  }

  if (/^(anong pangalan mo|ano pangalan mo|sino ka|what is your name|whats your name)$/i.test(text)) {
    return "I'm H.A.I.V.A., your personal AI assistant, Master.";
  }

  if (/^(ano ang kaya mo|anong kaya mo|what can you do|what do you do)$/i.test(text)) {
    return "I can chat with you, listen through voice mode, respond by voice, and later connect to my AI brains and tools.";
  }

  if (/^(salamat|thank you|thanks|thank you haiva)$/i.test(text)) {
    return "You're welcome, Master.";
  }

  if (/^(good morning|good afternoon|good evening)$/i.test(text)) {
    return `Good ${text.replace("good ", "")}, Master.`;
  }

  return null;
}

function getOfflineResponse(command) {
  const text = String(command || "").trim();
  if (!text) return null;

  // The local conversation layer intentionally remains useful without an API key.
  // It prevents the APK chat/voice pipeline from becoming a dead end while the
  // remote AI service is being configured.
  return `I received your message: “${text}”. My AI brain is currently offline, but the H.A.I.V.A. conversation system is working. You can continue testing chat and voice mode. Master.`;
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
      // is not configured yet.
      const basicResponse = getBasicResponse(text);
      if (basicResponse) return basicResponse;

      try {
        const result = await routeRequest(text);
        if (result?.response) return String(result.response).trim();
      } catch (error) {
        console.warn("[HAIVA] Remote AI unavailable; using local conversation fallback.", error);
      }

      return getOfflineResponse(text) || CONFIG.assistant.fallbackResponse;
    } catch (error) {
      console.error("Assistant response failed:", error);
      return getOfflineResponse(text) || CONFIG.assistant.fallbackResponse;
    } finally {
      this.processing = false;
    }
  }
}
