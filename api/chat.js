// =========================================
// H.A.I.V.A. AI CHAT API
// Multi-Brain: Groq → Gemini → OpenAI
// =========================================

import { buildProviderRequest, extractProviderAnswer, listProviders, getConfiguredProviders, MULTIBRAIN_ORDER } from "./provider-gateway.js";

function setCors(res) {
  // The Android APK loads the UI from file://, so the remote brain endpoint
  // must explicitly allow the WebView origin. This does not expose API keys;
  // provider credentials remain server-side in Vercel environment variables.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "H.A.I.V.A. AI API",
      providers: listProviders(),
      multibrain: MULTIBRAIN_ORDER,
      configuredBrains: getConfiguredProviders(),
      routing: "groq → gemini → openai"
    });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, response: "Method not allowed." });

  const message = req.body?.message;
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const requestedProvider = req.body?.provider;
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
- The browser/Android shell handles voice recognition, speech synthesis, and local UI state.
- You handle reasoning and conversation.

Respond directly to the user's latest message.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...safeHistory,
    { role: "user", content: message.trim() }
  ];

  const candidates = requestedProvider
    ? [requestedProvider, ...MULTIBRAIN_ORDER.filter(id => id !== requestedProvider)]
    : MULTIBRAIN_ORDER;

  const errors = [];

  for (const providerId of candidates) {
    let request;
    try {
      request = buildProviderRequest(providerId, messages, { maxTokens: 384, temperature: 0.2 });
    } catch (error) {
      errors.push({ provider: providerId, code: error?.code || "PROVIDER_ERROR", message: error?.message });
      continue;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const providerResponse = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: request.body,
        signal: controller.signal
      });
      const responseText = await providerResponse.text();
      let data = null;
      try { data = JSON.parse(responseText); } catch (_) {}

      if (!providerResponse.ok) {
        const providerMessage = data?.error?.message || "Unknown provider error.";
        console.error("[HAIVA] multibrain provider rejected request", { provider: request.provider.id, status: providerResponse.status, message: providerMessage });
        errors.push({ provider: request.provider.id, code: "AI_PROVIDER_ERROR", status: providerResponse.status });
        continue;
      }

      const answer = extractProviderAnswer(request.provider.id, data);
      if (!answer) {
        errors.push({ provider: request.provider.id, code: "AI_EMPTY_RESPONSE" });
        continue;
      }

      return res.status(200).json({
        ok: true,
        provider: request.provider.id,
        model: request.provider.model,
        response: answer,
        message: answer,
        multibrain: { attempted: errors.map(item => item.provider).concat(request.provider.id), fallbackUsed: errors.length > 0 }
      });
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      console.error("[HAIVA] multibrain provider request failed", { provider: request.provider.id, name: error?.name, message: error?.message });
      errors.push({ provider: request.provider.id, code: timedOut ? "AI_TIMEOUT" : "AI_CONNECTION_ERROR" });
    } finally {
      clearTimeout(timeout);
    }
  }

  return res.status(503).json({
    ok: false,
    code: "MULTIBRAIN_UNAVAILABLE",
    response: "All configured H.A.I.V.A. AI brains are currently unavailable, Master.",
    multibrain: { order: candidates, errors: errors.map(({ provider, code, status }) => ({ provider, code, status })) }
  });
}
