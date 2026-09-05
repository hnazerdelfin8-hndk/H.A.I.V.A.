const PROVIDERS = Object.freeze({
  groq: {
    id: "groq",
    env: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "openai/gpt-oss-20b",
    protocol: "openai-compatible"
  },
  gemini: {
    id: "gemini",
    env: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    model: "gemini-3.6-flash",
    protocol: "gemini"
  },
  openai: {
    id: "openai",
    env: "OPENAI_API_KEY",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    protocol: "openai-compatible"
  }
});

export const MULTIBRAIN_ORDER = Object.freeze(["groq", "gemini", "openai"]);

export function getProvider(id = "groq") {
  return PROVIDERS[String(id).toLowerCase()] || PROVIDERS.groq;
}

export function listProviders(env = process.env) {
  return Object.values(PROVIDERS).map(provider => ({
    id: provider.id,
    model: provider.model,
    configured: Boolean(env?.[provider.env])
  }));
}

export function getConfiguredProviders(env = process.env) {
  return MULTIBRAIN_ORDER.filter(id => Boolean(env?.[PROVIDERS[id].env]));
}

export function buildProviderRequest(providerId, messages, options = {}, env = process.env) {
  const provider = getProvider(providerId);
  const apiKey = env?.[provider.env];
  if (!apiKey) {
    const error = new Error(`${provider.id} is not configured`);
    error.code = "PROVIDER_NOT_CONFIGURED";
    error.provider = provider.id;
    throw error;
  }

  const maxTokens = options.maxTokens || 384;
  const temperature = options.temperature ?? 0.2;
  const headers = { "Content-Type": "application/json" };
  let url = provider.url;
  let body;

  if (provider.protocol === "openai-compatible") {
    headers.Authorization = `Bearer ${apiKey}`;
    body = JSON.stringify({ model: provider.model, messages, max_tokens: maxTokens, temperature });
  } else {
    const system = messages.find(item => item.role === "system")?.content || "";
    const contents = messages.filter(item => item.role !== "system").map(item => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }]
    }));
    body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature }
    });
    url = `${provider.url}?key=${encodeURIComponent(apiKey)}`;
  }

  return { provider, url, headers, body };
}

export function extractProviderAnswer(providerId, data) {
  const provider = getProvider(providerId);
  if (provider.protocol === "gemini") return data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim() || "";
  return data?.choices?.[0]?.message?.content?.trim() || "";
}
