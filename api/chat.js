// =========================================
// H.A.I.V.A. AI CHAT API — OPENAI
// =========================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      response: "Method not allowed."
    });
  }

  const message = req.body?.message;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      response: "Please provide a message."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("OPENAI_API_KEY is not configured.");
    return res.status(500).json({
      response: "My OpenAI connection is not configured yet, Master."
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions: `You are H.A.I.V.A., an intelligent voice assistant.

Address the user as "Master".

Be helpful, concise, natural, and conversational.

You are primarily a voice assistant, so responses should normally be easy to understand when spoken aloud.

Do not describe yourself as a chatbot unless specifically asked.

If the user speaks Filipino or Taglish, respond naturally in Filipino or Taglish.

Do not use unnecessary markdown in normal voice responses.`,
        input: message.trim(),
        max_output_tokens: 512
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return res.status(502).json({
        response: "I'm having trouble reaching my OpenAI system right now, Master."
      });
    }

    const data = await response.json();
    const answer = data?.output_text?.trim();

    if (!answer) {
      console.error("OpenAI returned no text.", data);
      return res.status(502).json({
        response: "I received an empty response from my AI system, Master."
      });
    }

    return res.status(200).json({
      response: answer,
      message: answer
    });
  } catch (error) {
    console.error("H.A.I.V.A. OpenAI request failed:", error);
    return res.status(500).json({
      response: "Something went wrong while connecting to my OpenAI system, Master."
    });
  }
}
