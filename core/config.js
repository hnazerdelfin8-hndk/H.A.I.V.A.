// =========================================
// H.A.I.V.A. CONFIGURATION
// =========================================

export const CONFIG = {
  app: {
    name: "H.A.I.V.A.",
    fullName: "Hnazer Artificial Intelligence Voice Assistant",
    version: "3.0.0"
  },

  environment: "production",

  api: {
    // Absolute production endpoint so the bundled Android WebView can reach
    // the H.A.I.V.A. backend instead of resolving /api/chat against file://.
    chatEndpoint: "https://h-a-i-v-a-hnrk.vercel.app/api/chat"
  },

  voice: {
    recognitionLanguage: "en-US",
    speechLanguage: "en-US",
    continuous: true,
    interimResults: true,
    speechRate: 0.92,
    speechPitch: 1.0,
    speechVolume: 1.0,
    restartDelay: 650,

    // Voice timing is owned by the native/browser recognition engines.
    // H.A.I.V.A. does not add a custom initial or post-speech grace timer.

    wakeWords: [
      "yo haiva",
      "yo h a i v a",
      "hey haiva",
      "hi haiva",
      "haiva"
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
    commandRouter: true,
    voiceBargeIn: true,
    voiceInterrupt: true
  }
};
