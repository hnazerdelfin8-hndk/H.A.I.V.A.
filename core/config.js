// =========================================
// H.A.I.V.A. CONFIGURATION
// =========================================

export const CONFIG = {
  app: {
    name: "H.A.I.V.A.",
    fullName: "Hnazer Artificial Intelligence Voice Assistant",
    version: "2.4.0"
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

    // CANONICAL VOICE SYNCHRONIZATION CONTRACT.
    // All voice adapters must use these values; core/app.js owns the state flow.
    timing: {
      initialSpeechGraceMs: 3000,
      postSpeechSilenceMs: 2000
    },

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
    commandRouter: true
  }
};
