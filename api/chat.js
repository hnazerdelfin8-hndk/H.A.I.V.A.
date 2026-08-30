// =========================================
// H.A.I.V.A. Gemini Chat API
// Vercel Serverless Function
// =========================================

export default async function handler(req, res) {

  // -----------------------------------------
  // Method Check
  // -----------------------------------------

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed.",
      message: "Use POST /api/chat."
    });
  }

  try {

    // ---------------------------------------
    // Read Request
    // ---------------------------------------

    const { message } = req.body || {};

    if (
      !message ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "Message is required.",
        message: "Send a non-empty string in the 'message' field."
      });
    }

    const userMessage = message.trim();

    // ---------------------------------------
    // Gemini API Key
    // ---------------------------------------

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        "H.A.I.V.A.: GEMINI_API_KEY is missing."
      );

      return res.status(500).json({
        error: "Gemini API key is not configured.",
        code: "MISSING_GEMINI_API_KEY"
      });
    }

    // ---------------------------------------
    // Analyze Request
    // ---------------------------------------

    const text = userMessage.toLowerCase();

    const containsAny = (words) =>
      words.some(word => text.includes(word));

    const codingWords = [
      "code",
      "coding",
      "javascript",
      "html",
      "css",
      "python",
      "java",
      "php",
      "sql",
      "json",
      "api",
      "github",
      "vercel",
      "supabase",
      "npm",
      "node",
      "react",
      "database",
      "backend",
      "frontend",
      "debug",
      "debugging",
      "bug",
      "error",
      "programming",
      "script"
    ];

    const complexWords = [
      "solve",
      "analyze",
      "analysis",
      "reason",
      "reasoning",
      "complex",
      "architecture",
      "strategy",
      "optimize",
      "optimization",
      "diagnose",
      "diagnostic",
      "troubleshoot",
      "troubleshooting",
      "why is",
      "why does",
      "how can i fix",
      "how do i fix",
      "paano ayusin",
      "bakit ayaw"
    ];

    const veryComplexWords = [
      "build a complete",
      "build an entire",
      "full system",
      "full application",
      "complete application",
      "complex application",
      "complex system",
      "production system",
      "large codebase",
      "advanced coding",
      "refactor entire"
    ];

    const vaWords = [
      "email",
      "client",
      "customer",
      "calendar",
      "schedule",
      "appointment",
      "meeting",
      "social media",
      "facebook",
      "instagram",
      "tiktok",
      "caption",
      "spreadsheet",
      "data entry",
      "research",
      "virtual assistant",
      "va task",
      "organize",
      "summarize",
      "summary",
      "rewrite",
      "proofread",
      "reply",
      "message"
    ];

    const isCoding = containsAny(codingWords);
    const isComplex = containsAny(complexWords);
    const isVeryComplex = containsAny(veryComplexWords);
    const isVA = containsAny(vaWords);

    // -----------------------------------------
    // Model Selection
    // -----------------------------------------

    let selectedModel;
    let thinkingLevel;
    let maxOutputTokens;

    if (isVeryComplex && isCoding) {

      selectedModel = "gemini-3.7-flash";
      thinkingLevel = "high";
      maxOutputTokens = 2048;

    } else if (isComplex && isCoding) {

      selectedModel = "gemini-3.7-flash";
      thinkingLevel = "medium";
      maxOutputTokens = 1536;

    } else if (isCoding) {

      selectedModel = "gemini-3.5-flash";
      thinkingLevel = "low";
      maxOutputTokens = 1024;

    } else if (isComplex) {

      selectedModel = "gemini-3.6-flash";
      thinkingLevel = "medium";
      maxOutputTokens = 1536;

    } else if (isVA) {

      selectedModel = "gemini-3.5-flash-lite";
      thinkingLevel = "low";
      maxOutputTokens = 768;

    } else {

      selectedModel = "gemini-3.1-flash-lite";
      thinkingLevel = "low";
      maxOutputTokens = 512;
    }

    // -----------------------------------------
    // Fallback Models
    // -----------------------------------------

    const fallbackModels = [
      selectedModel,
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite"
    ];

    const models = [
      ...new Set(fallbackModels)
    ];

    // -----------------------------------------
    // System Instruction
    // -----------------------------------------

    const systemInstruction = `
You are H.A.I.V.A.
Hnazer Artificial Intelligence Voice Assistant.

You are a fast, intelligent and practical AI assistant
for virtual assistant work, productivity, research,
customer support, email management, calendar management,
social media, coding, automation and troubleshooting.

IMPORTANT:
- Prioritize speed for simple questions.
- Answer simple questions briefly.
- Give direct useful answers.
- Solve problems instead of only describing them.
- For technical problems, give exact actionable steps.
- Do not unnecessarily repeat information.
- Never invent passwords, API keys, credentials or results.
- Never claim an action was performed if it was not performed.

LANGUAGE:
- The user may speak English, Tagalog or Taglish.
- Reply naturally in the user's language.
- For Tagalog, use conversational Filipino.
- Avoid stiff machine translation.
- Sound natural when spoken aloud.

VOICE:
Your response may be converted to speech.
Use natural sentences.
Avoid unnecessary markdown and excessive formatting.

VA ASSISTANT:
Help with email, customer support, calendar,
social media, research, data entry, writing,
coding, debugging, automation and productivity.

When troubleshooting:
1. Identify the likely cause.
2. Give the exact fix.
3. Tell the user the next action.

Be concise unless the task requires detail.
`;

    // -----------------------------------------
    // Try Gemini Models
    // -----------------------------------------

    let lastError = null;

    for (const model of models) {

      try {

        console.log(
          `H.A.I.V.A.: Trying model ${model}`
        );

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify({

              systemInstruction: {
                parts: [
                  {
                    text: systemInstruction
                  }
                ]
              },

              contents: [
                {
                  role: "user",

                  parts: [
                    {
                      text: userMessage
                    }
                  ]
                }
              ],

              generationConfig: {

                thinkingConfig: {
                  thinkingLevel:
                    model === "gemini-3.7-flash"
                      ? thinkingLevel
                      : thinkingLevel === "high"
                        ? "medium"
                        : thinkingLevel
                },

                maxOutputTokens
              }

            })
          }
        );

        // ---------------------------------------
        // Parse Gemini Response
        // ---------------------------------------

        let data;

        try {

          data = await response.json();

        } catch (parseError) {

          lastError =
            `Invalid JSON response from Gemini (${response.status}).`;

          console.error(
            "H.A.I.V.A. JSON parse error:",
            model,
            parseError
          );

          continue;
        }

        // ---------------------------------------
        // Gemini API Error
        // ---------------------------------------

        if (!response.ok) {

          const apiError =
            data?.error?.message ||
            `Gemini returned HTTP ${response.status}.`;

          lastError = apiError;

          console.error(
            `H.A.I.V.A.: Model ${model} failed:`,
            apiError
          );

          continue;
        }

        // ---------------------------------------
        // Extract Reply
        // ---------------------------------------

        const reply =
          data?.candidates?.[0]?.content?.parts
            ?.map(part => part?.text || "")
            .join("")
            .trim();

        if (!reply) {

          const finishReason =
            data?.candidates?.[0]?.finishReason ||
            "UNKNOWN";

          lastError =
            `Gemini returned no text. Finish reason: ${finishReason}`;

          console.error(
            `H.A.I.V.A.: Empty response from ${model}`,
            data
          );

          continue;
        }

        // ---------------------------------------
        // Success
        // ---------------------------------------

        console.log(
          `H.A.I.V.A.: Successfully used ${model}`
        );

        return res.status(200).json({

          reply,

          model,

          router: "automatic-speed",

          success: true

        });

      } catch (error) {

        lastError =
          error?.message ||
          "Unknown Gemini request error.";

        console.error(
          `H.A.I.V.A.: Request failed for ${model}:`,
          error
        );

        continue;
      }
    }

    // -----------------------------------------
    // All Models Failed
    // -----------------------------------------

    console.error(
      "H.A.I.V.A.: All Gemini models failed.",
      lastError
    );

    return res.status(502).json({

      error:
        "H.A.I.V.A. could not get a response from Gemini.",

      code:
        "ALL_GEMINI_MODELS_FAILED",

      details:
        lastError || "Unknown Gemini API error."

    });

  } catch (error) {

    // -----------------------------------------
    // Server Error
    // -----------------------------------------

    console.error(
      "H.A.I.V.A. server error:",
      error
    );

    return res.status(500).json({

      error:
        "H.A.I.V.A. server error.",

      code:
        "HAIVA_SERVER_ERROR",

      details:
        error?.message ||
        "Unknown server error."

    });
  }
}
