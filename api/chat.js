// =========================================
// H.A.I.V.A. AI CHAT API
// =========================================

import { buildProviderRequest, extractProviderAnswer, listProviders } from "./provider-gateway.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "H.A.I.V.A. AI API",
      providers: listProviders(),
      defaultProvider: "groq"
    });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, response: "Method not allowed." });

  const message = req.body?.message;
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const requestedProvider = req.body?.provider || "groq";
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ ok: false, response: "Please provide a message." });
  }

  const safeHistory = history
    .filter(item => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())
    .slice(-20)
    .map(item => ({ role: item.role, content: item.content.trim() }));

  const systemPrompt = `You are H.A.I.V.A., Hnazer Artificial Intelligence Voice Assistant, the user's personal AI assistant.

CORE BEHAVIOR:
- Prioritize accuracy, relevance, and understanding over sounding impressive.
- Answer the exact question first.
- Use supplied conversation history for follow-ups and references.
- If context cannot resolve a genuinely ambiguous request, ask one short clarification.
- Never invent facts, actions, links, capabilities, or memories.
- Never claim to have performed an action unless a connected tool actually performed it.

PERSONALITY:
- Calm, intelligent, warm, confident, loyal, and natural.
- Call the user "Master" naturally, but do not force it into every response.
- Do not sound robotic, overly formal, dramatic, or submissive.
- Be concise for simple questions and detailed only when needed.

LANGUAGE:
- Filipino input → natural Filipino.
- Taglish input → natural Taglish.
- English input → English.
- Keep technical terms in English when clearer.

VOICE:
- Write naturally for spoken audio.
- Prefer short, clear sentences.
- Avoid unnecessary headings, tables, disclaimers, and filler.

LIMITATIONS:
- The browser handles voice recognition, speech synthesis, and local UI state.
- You handle reasoning and conversation.

Respond directly to the user's latest message.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...safeHistory,
    { role: "user", content: message.trim() }
  ];

  try {
    const request = buildProviderRequest(requestedProvider, messages, { maxTokens: 384, temperature: 0.2 });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let providerResponse;
    try {
      providerResponse = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: request.body,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await providerResponse.text();
    let data = null;
    try { data = JSON.parse(responseText); } catch (_) {}

    if (!providerResponse.ok) {
      const providerMessage = data?.error?.message || "Unknown provider error.";
      console.error("[HAIVA] provider rejected request", { provider: request.provider.id, status: providerResponse.status, message: providerMessage });
      return res.status(502).json({ ok: false, code: "AI_PROVIDER_ERROR", provider: request.provider.id, response: `My AI provider returned an error (${providerResponse.status}). Please check the provider configuration, Master.` });
    }

    const answer = extractProviderAnswer(request.provider.id, data);
    if (!answer) return res.status(502).json({ ok: false, code: "AI_EMPTY_RESPONSE", response: "I received an empty response from my AI system, Master." });

    return res.status(200).json({ ok: true, provider: request.provider.id, model: request.provider.model, response: answer, message: answer });
  } catch (error) {
    if (error?.code === "PROVIDER_NOT_CONFIGURED") {
      return res.status(503).json({ ok: false, code: "PROVIDER_NOT_CONFIGURED", provider: error.provider, response: `The ${error.provider} provider is not configured yet, Master.` });
    }
    const timedOut = error?.name === "AbortError";
    console.error("[HAIVA] provider request failed", { name: error?.name, message: error?.message });
    return res.status(timedOut ? 504 : 500).json({ ok: false, code: timedOut ? "AI_TIMEOUT" : "AI_CONNECTION_ERROR", response: timedOut ? "My AI system took too long to respond. Please try again, Master." : "Something went wrong while connecting to my AI system, Master." });
  }
}
