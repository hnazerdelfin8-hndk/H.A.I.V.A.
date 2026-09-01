// =========================================
// H.A.I.V.A. AI CHAT API — GROQ
// =========================================

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ response: "Method not allowed." });

  const message = req.body?.message;
  if (typeof message !== "string" || !message.trim()) return res.status(400).json({ response: "Please provide a message." });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ response: "My Groq connection is not configured yet, Master." });

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: 'You are H.A.I.V.A., a fast intelligent voice assistant. Address the user as "Master". Be helpful, natural, concise and conversational. Give short answers by default because responses are spoken aloud. If the user speaks Filipino or Taglish, respond naturally in Filipino or Taglish. Avoid unnecessary markdown and filler.' },
          { role: "user", content: message.trim() }
        ],
        max_tokens: 256
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
