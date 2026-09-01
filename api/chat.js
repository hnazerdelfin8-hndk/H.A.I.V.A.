// =========================================
// H.A.I.V.A. AI CHAT API — GROQ
// =========================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ response: "Method not allowed." });
  }

  const message = req.body?.message;
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ response: "Please provide a message." });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("[HAIVA] GROQ_API_KEY missing in Vercel runtime.");
    return res.status(500).json({
      response: "My Groq connection is not configured yet, Master."
    });
  }

  try {
    console.log("[HAIVA] Groq request starting", {
      model: "openai/gpt-oss-20b",
      messageLength: message.trim().length
    });

    const groqResponse = await fetch("https://api.groq.com/openai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
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

    const responseText = await groqResponse.text();

    if (!groqResponse.ok) {
      let errorCode = "unknown";
      let errorType = "unknown";

      try {
        const parsed = JSON.parse(responseText);
        errorCode = parsed?.error?.code || errorCode;
        errorType = parsed?.error?.type || errorType;
      } catch (_) {
        // Keep diagnostics generic if Groq did not return JSON.
      }

      console.error("[HAIVA] Groq API rejected request", {
        status: groqResponse.status,
        errorType,
        errorCode
      });

      return res.status(502).json({
        response: `Groq connection error (${groqResponse.status}). Please check the Vercel API configuration, Master.`
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      console.error("[HAIVA] Groq returned invalid JSON.", error);
      return res.status(502).json({
        response: "My AI system returned an invalid response, Master."
      });
    }

    const answer = data?.output_text?.trim();

    if (!answer) {
      console.error("[HAIVA] Groq returned no output text.", {
        hasOutput: Array.isArray(data?.output),
        outputCount: data?.output?.length ?? 0
      });
      return res.status(502).json({
        response: "I received an empty response from my AI system, Master."
      });
    }

    console.log("[HAIVA] Groq response received", {
      answerLength: answer.length
    });

    return res.status(200).json({
      response: answer,
      message: answer
    });
  } catch (error) {
    console.error("[HAIVA] Groq request failed", {
      name: error?.name,
      message: error?.message
    });

    return res.status(500).json({
      response: "Something went wrong while connecting to my Groq system, Master."
    });
  }
}
