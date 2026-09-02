// =========================================
// H.A.I.V.A. TOOLS API
// =========================================

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function json(status, body) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  const { tool, query } = req.body || {};
  if (!tool || !query) {
    return res.status(400).json({ success: false, error: "Tool and query are required." });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: "GROQ_API_KEY is not configured." });
  }

  const prompts = {
    web_search: `Search the web for the user's request and answer using current, relevant information. Be factual and concise. User request: ${query}`,
    weather: `Find the current weather and a short forecast for the location in this request. If no location is given, say that a city/location is needed. Use current web information. User request: ${query}`
  };

  const prompt = prompts[tool];
  if (!prompt) {
    return res.status(400).json({ success: false, error: "Unsupported tool." });
  }

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "groq/compound",
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("H.A.I.V.A. tools API error:", data);
      return res.status(response.status).json({ success: false, error: "The tool request failed." });
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return res.status(502).json({ success: false, error: "The tool returned an empty response." });
    }

    return res.status(200).json({ success: true, tool, response: answer });
  } catch (error) {
    console.error("H.A.I.V.A. tools API failed:", error);
    return res.status(500).json({ success: false, error: "Unable to use the tool right now." });
  }
}
