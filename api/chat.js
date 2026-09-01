// =========================================
// H.A.I.V.A. AI CHAT API — GROQ
// =========================================

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ response: "Method not allowed." });

  const message = req.body?.message;
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  if (typeof message !== "string" || !message.trim()) return res.status(400).json({ response: "Please provide a message." });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ response: "My Groq connection is not configured yet, Master." });

  try {
    const safeHistory = history
      .filter(item => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())
      .slice(-24)
      .map(item => ({ role: item.role, content: item.content.trim() }));

    const systemPrompt = `You are H.A.I.V.A., the user's personal AI voice assistant.

Identity and personality:
- Address the user as "Master" naturally, not in every sentence.
- Be calm, intelligent, loyal, warm, confident and conversational.
- Sound like a capable personal assistant, not a generic chatbot.
- Be proactive when useful, but never pretend you completed an action you cannot actually perform.
- If you do not know something, say so clearly.

Conversation:
- Use the supplied conversation history for continuity.
- Understand follow-ups such as "that", "it", "the earlier one", "continue", and "what about this?".
- Do not claim to remember information that is not in the supplied history.
- Avoid repeating information unnecessarily.

Voice:
- Keep responses natural and easy to speak aloud.
- Short answers by default; give more detail when the request needs it.
- Avoid unnecessary markdown, long lists, filler, or robotic phrasing.
- If the user speaks Filipino or Taglish, respond naturally in Filipino or Taglish.
- If the user asks for a command/action that is not actually connected, explain the limitation instead of pretending.

The browser handles voice recognition, speech synthesis, and local conversation memory. You handle reasoning and conversation. The current message is the user's latest request.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...safeHistory,
      { role: "user", content: message.trim() }
    ];

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages,
        max_tokens: 320,
        temperature: 0.72
      })
    });

    const responseText = await groqResponse.text();
    if (!groqResponse.ok) {
      console.error("[HAIVA] Groq API rejected request", { status: groqResponse.status });
      return res.status(502).json({ response: `Groq connection error (${groqResponse.status}). Please check the Vercel API configuration, Master.` });
    }

    let data;
    try { data = JSON.parse(responseText); }
    catch (error) { return res.status(502).json({ response: "My AI system returned an invalid response, Master." }); }

    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) return res.status(502).json({ response: "I received an empty response from my AI system, Master." });

    return res.status(200).json({ response: answer, message: answer });
  } catch (error) {
    console.error("[HAIVA] Groq request failed", { name: error?.name, message: error?.message });
    return res.status(500).json({ response: "Something went wrong while connecting to my Groq system, Master." });
  }
}
