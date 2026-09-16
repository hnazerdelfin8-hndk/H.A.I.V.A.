// =========================================
// H.A.I.V.A. BRAIN — DECISION MAKING
// =========================================

const END_CONVERSATION_PATTERNS = Object.freeze([
  /^(?:okay[,. ]*)?(?:goodbye|good bye|bye)(?:[,. ]+haiva)?$/i,
  /^(?:okay[,. ]*)?(?:thank you|thanks)[,. ]+(?:goodbye|bye)$/i,
  /^(?:i(?:'m| am) done|that's all|thats all)$/i
]);

const INTERRUPTION_PATTERNS = Object.freeze([
  /^(?:please[,. ]*)?(?:stop|stop muna|hinto|hinto muna|teka|teka lang|wait|wait lang|hold on|pause|sandali|sandali lang|hintay|hintay lang|cancel|cancel muna|wag na|huwag na|never mind)(?:[,. ]+(.*))?$/i,
  /^(?:okay|ok)[,. ]+(?:stop|wait|teka|sandali)(?:[,. ]+(.*))?$/i
]);

const normalize = value => String(value ?? "")
  .toLowerCase()
  .replace(/[.,!?]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export function decideVoiceControl(input, { phase = "LISTENING" } = {}) {
  const text = normalize(input);
  if (!text) {
    return Object.freeze({ action: "ignore", intent: "unknown", endConversation: false, instruction: "", text });
  }

  if (phase === "SPEAKING") {
    for (const pattern of INTERRUPTION_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return Object.freeze({
          action: "interrupt",
          intent: "interrupt",
          endConversation: false,
          instruction: normalize(match[1] || ""),
          text
        });
      }
    }
  }

  const endConversation = END_CONVERSATION_PATTERNS.some(pattern => pattern.test(text));
  return Object.freeze({
    action: "respond",
    intent: endConversation ? "end_conversation" : "conversation",
    endConversation,
    instruction: "",
    text
  });
}

export function decide(intent, skills = []) {
  const available = new Set(Array.isArray(skills) ? skills.map(String) : []);

  if (intent?.name && available.has(intent.name)) {
    return { action: "skill", skill: intent.name, confidence: intent.confidence || 0 };
  }

  return { action: "ai", skill: null, confidence: intent?.confidence || 0 };
}
