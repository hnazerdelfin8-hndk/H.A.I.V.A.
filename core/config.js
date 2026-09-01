// =========================================
// H.A.I.V.A. CONFIGURATION
// =========================================

export const CONFIG = {
  app: {
    name: "H.A.I.V.A.",
    fullName: "Hnazer Artificial Intelligence Voice Assistant",
    version: "2.1.0"
  },

  environment: "production",

  api: {
    chatEndpoint: "/api/chat"
  },

  voice: {
    // Wake phrase is intentionally explicit. Do not wake on "haiva" alone.
    wakeWords: [
      "yo haiva",
      "yo, haiva",
      "yo h a i v a",
      "yo hi va",
      "yo heyva",
      "yo aiva"
    ],

    recognitionLanguage: "en-US",
    speechLanguage: "en-US",
    continuous: true,
    interimResults: true,
    speechRate: 0.95,
    speechPitch: 1.0,
    speechVolume: 1.0,
    restartDelay: 500
  },

  assistant: {
    name: "H.A.I.V.A.",
    userTitle: "Master",
    defaultGreeting: "Yes, Master. I'm listening.",
    fallbackResponse: "I'm sorry, Master. I couldn't process that.",
    connectionError: "I'm having trouble connecting to my AI system."
  },

  features: {
    voice: true,
    chat: true,
    skills: true,
    wakeWord: true,
    textToSpeech: true
  }
};
