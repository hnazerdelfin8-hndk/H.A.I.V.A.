// =========================================
// H.A.I.V.A. AI CHAT API — GROQ
// =========================================

const MODEL = "openai/gpt-oss-20b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "H.A.I.V.A. AI API",
      provider: "Groq",
      configured: Boolean(process.env.GROQ_API_KEY),
      model: MODEL
    });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, response: "Method not allowed." });

  const message = req.body?.message;
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ ok: false, response: "Please provide a message." });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("[HAIVA] GROQ_API_KEY is missing in the server environment.");
    return res.status(503).json({ ok: false, code: "AI_NOT_CONFIGURED", response: "My AI connection is not configured yet. Please add GROQ_API_KEY to the server environment, Master." });
  }

  try {
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let groqResponse;
    try {
      groqResponse = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODEL, messages, max_tokens: 384, temperature: 0.2 }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await groqResponse.text();
    if (!groqResponse.ok) {
      let providerMessage = "Unknown provider error.";
      try { providerMessage = JSON.parse(responseText)?.error?.message || providerMessage; } catch (_) {}
      console.error("[HAIVA] Groq rejected request", { status: groqResponse.status, message: providerMessage });
      return res.status(502).json({ ok: false, code: "AI_PROVIDER_ERROR", response: `My AI provider returned an error (${groqResponse.status}). Please check the Groq API key, model access, and server configuration, Master.` });
    }

    let data;
    try { data = JSON.parse(responseText); }
    catch (_) { return res.status(502).json({ ok: false, code: "AI_INVALID_RESPONSE", response: "My AI system returned an invalid response, Master." }); }

    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) return res.status(502).json({ ok: false, code: "AI_EMPTY_RESPONSE", response: "I received an empty response from my AI system, Master." });

    return res.status(200).json({ ok: true, response: answer, message: answer });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error("[HAIVA] Groq request failed", { name: error?.name, message: error?.message });
    return res.status(timedOut ? 504 : 500).json({ ok: false, code: timedOut ? "AI_TIMEOUT" : "AI_CONNECTION_ERROR", response: timedOut ? "My AI system took too long to respond. Please try again, Master." : "Something went wrong while connecting to my AI system, Master." });
  }
}
