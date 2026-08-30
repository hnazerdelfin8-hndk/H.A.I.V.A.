// H.A.I.V.A. Configuration

export const CONFIG = {
  app: {
    name: "H.A.I.V.A.",
    fullName: "Hnazer Artificial Intelligence Voice Assistant",
    version: "1.0.0"
  },

  environment: "production",

  api: {
    chatEndpoint: "/api/chat"
  },

  voice: {
    wakeWords: [
      "yo haiva",
      "hey haiva",
      "hi haiva",
      "haiva"
    ],

    language: "en-US",
    speechLanguage: "fil-PH",
    speechRate: 0.95,
    speechPitch: 1.0,
    speechVolume: 1.0
  },

  features: {
    voice: true,
    chat: true
  }
};
