// =========================================
// H.A.I.V.A. AI CHAT API — OPENAI
// =========================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ response: "Method not allowed." });
  }

  const message = req.body?.message;
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ response: "Please provide a message." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[HAIVA] OPENAI_API_KEY missing in Vercel runtime.");
    return res.status(500).json({
      response: "My OpenAI connection is not configured yet, Master."
    });
  }

  try {
    console.log("[HAIVA] OpenAI request starting", {
      model: "gpt-5.6-luna",
      messageLength: message.trim().length
    });

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
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

    const responseText = await openaiResponse.text();

    if (!openaiResponse.ok) {
      let errorCode = "unknown";
      let errorType = "unknown";

      try {
        const parsed = JSON.parse(responseText);
        errorCode = parsed?.error?.code || errorCode;
        errorType = parsed?.error?.type || errorType;
      } catch (_) {
        // Keep diagnostics generic if OpenAI did not return JSON.
      }

      console.error("[HAIVA] OpenAI API rejected request", {
        status: openaiResponse.status,
        errorType,
        errorCode
      });

      return res.status(502).json({
        response: `OpenAI connection error (${openaiResponse.status}). Please check the Vercel API configuration, Master.`
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      console.error("[HAIVA] OpenAI returned invalid JSON.", error);
      return res.status(502).json({
        response: "My AI system returned an invalid response, Master."
      });
    }

    const answer = data?.output_text?.trim();

    if (!answer) {
      console.error("[HAIVA] OpenAI returned no output text.", {
        hasOutput: Array.isArray(data?.output),
        outputCount: data?.output?.length ?? 0
      });
      return res.status(502).json({
        response: "I received an empty response from my AI system, Master."
      });
    }

    console.log("[HAIVA] OpenAI response received", {
      answerLength: answer.length
    });

    return res.status(200).json({
      response: answer,
      message: answer
    });
  } catch (error) {
    console.error("[HAIVA] OpenAI request failed", {
      name: error?.name,
      message: error?.message
    });

    return res.status(500).json({
      response: "Something went wrong while connecting to my OpenAI system, Master."
    });
  }
}
