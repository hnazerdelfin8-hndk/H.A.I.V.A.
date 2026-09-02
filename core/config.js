// =========================================
// H.A.I.V.A. CONFIGURATION
// =========================================

export const CONFIG = {
  app: {
    name: "H.A.I.V.A.",
    fullName: "Hnazer Artificial Intelligence Voice Assistant",
    version: "2.3.1"
  },

  environment: "production",

  api: {
    chatEndpoint: "/api/chat"
  },

  voice: {
    recognitionLanguage: "en-US",
    speechLanguage: "en-US",
    continuous: true,
    interimResults: true,
    speechRate: 0.92,
    speechPitch: 1.0,
    speechVolume: 1.0,
    restartDelay: 500,
    wakeWords: [
      "yo haiva",
      "yo h a i v a"
    ]
  },

  assistant: {
    name: "H.A.I.V.A.",
    userTitle: "Master",
    personality: "calm, intelligent, loyal, natural, proactive and conversational",
    defaultGreeting: "Yes, Master. I'm listening.",
    fallbackResponse: "I'm sorry, Master. I couldn't process that.",
    connectionError: "I'm having trouble connecting to my AI system."
  },

  features: {
    voice: true,
    chat: true,
    skills: true,
    wakeWord: true,
    textToSpeech: true,
    memory: true,
    commandRouter: true
  }
};
