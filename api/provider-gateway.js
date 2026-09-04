const PROVIDERS = Object.freeze({
  groq: {
    id: "groq",
    env: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "openai/gpt-oss-20b",
    protocol: "openai-compatible"
  },
  openai: {
    id: "openai",
    env: "OPENAI_API_KEY",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    protocol: "openai-compatible"
  },
  gemini: {
    id: "gemini",
    env: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    model: "gemini-2.5-flash",
    protocol: "gemini"
  },
  anthropic: {
    id: "anthropic",
    env: "ANTHROPIC_API_KEY",
    url: "https://api.anthropic.com/v1/messages",
    model: "claude-3-5-haiku-latest",
    protocol: "anthropic"
  }
});

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
  } else if (provider.protocol === "gemini") {
    url = `${provider.url}?key=${encodeURIComponent(apiKey)}`;
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
  } else {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    const system = messages.find(item => item.role === "system")?.content || "";
    const contents = messages.filter(item => item.role !== "system");
    body = JSON.stringify({ model: provider.model, max_tokens: maxTokens, temperature, system, messages: contents });
  }

  return { provider, url, headers, body };
}

export function extractProviderAnswer(providerId, data) {
  const provider = getProvider(providerId);
  if (provider.protocol === "anthropic") return data?.content?.find(item => item.type === "text")?.text?.trim() || "";
  if (provider.protocol === "gemini") return data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim() || "";
  return data?.choices?.[0]?.message?.content?.trim() || "";
}
