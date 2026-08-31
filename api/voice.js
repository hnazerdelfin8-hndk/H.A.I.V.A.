export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { text } = req.body || {};

    if (!text) {
      return res.status(400).json({
        error: "No text received"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is not configured"
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "You are H.A.I.V.A., a helpful voice assistant. " +
                  "Be concise and natural because your responses will be spoken aloud. " +
                  "Address the user as Master when appropriate."
              }
            ]
          },

          contents: [
            {
              role: "user",
              parts: [
                {
                  text: text
                }
              ]
            }
          ],

          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error: "Gemini request failed",
        details: data
      });
    }

    const answer =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!answer) {
      return res.status(500).json({
        error: "Gemini returned no text"
      });
    }

    return res.status(200).json({
      success: true,
      text: answer
    });

  } catch (error) {

    console.error(
      "H.A.I.V.A. voice API error:",
      error
    );

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
