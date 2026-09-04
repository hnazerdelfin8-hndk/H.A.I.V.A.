// =========================================
// H.A.I.V.A. PROVIDER REGISTRY
// Layer 7: API + Tool Gateway
// =========================================

const PROVIDERS = Object.freeze({
  groq: { id: "groq", env: "GROQ_API_KEY", endpoint: "/api/chat", default: true },
  gemini: { id: "gemini", env: "GEMINI_API_KEY", endpoint: "/api/chat" },
  openai: { id: "openai", env: "OPENAI_API_KEY", endpoint: "/api/chat" },
  anthropic: { id: "anthropic", env: "ANTHROPIC_API_KEY", endpoint: "/api/chat" }
});

export function getProvider(id = "groq") {
  return PROVIDERS[String(id).toLowerCase()] || PROVIDERS.groq;
}

export function listProviders() {
  return Object.values(PROVIDERS).map(provider => ({ ...provider }));
}

export function selectProvider(preferred) {
  const provider = getProvider(preferred || "groq");
  return provider;
}
