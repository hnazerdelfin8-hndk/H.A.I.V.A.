// =========================================
// H.A.I.V.A. CONFIGURATION
// =========================================

export const CONFIG = {
  app: {
    name: "H.A.I.V.A.",
    fullName:
      "Hnazer Artificial Intelligence Voice Assistant",
    version: "2.0.0"
  },

  environment: "production",

  api: {
    chatEndpoint: "/api/chat"
  },

  voice: {
    wakeWords: [
      "yo haiva",
      "yo, haiva",
      "hey haiva",
      "hey, haiva",
      "hi haiva",
      "hi, haiva",
      "yi haiva",
      "yi, haiva",
      "haiva"
    ],

    recognitionLanguage: "en-US",
    speechLanguage: "en-US",

    continuous: true,
    interimResults: false,

    speechRate: 0.95,
    speechPitch: 1.0,
    speechVolume: 1.0,

    restartDelay: 700
  },

  assistant: {
    name: "H.A.I.V.A.",
    userTitle: "Master",

    defaultGreeting:
      "Yes, Master. I'm listening.",

    fallbackResponse:
      "I'm sorry, Master. I couldn't process that.",

    connectionError:
      "I'm having trouble connecting to my AI system."
  },

  features: {
    voice: true,
    chat: true,
    skills: true,
    wakeWord: true,
    textToSpeech: true
  }
};
