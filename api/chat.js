export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured"
      });
    }

    const text = message.toLowerCase().trim();

    /*
      HAIVA SPEED-FIRST ROUTER

      Simple question
      → fastest model

      Normal VA task
      → lightweight Flash

      Technical
      → stronger Flash

      Complex reasoning
      → Gemini 3.6 Flash

      Very difficult technical task
      → Gemini 3.7 Flash
    */

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

    const containsAny = (words) =>
      words.some(word => text.includes(word));

    const isCoding = containsAny(codingWords);
    const isComplex = containsAny(complexWords);
    const isVeryComplex = containsAny(veryComplexWords);
    const isVA = containsAny(vaWords);

    let selectedModel;
    let thinkingLevel;
    let maxOutputTokens;

    /*
      SPEED-FIRST SELECTION
    */

    if (isVeryComplex && isCoding) {

      selectedModel = "gemini-3.7-flash";
      thinkingLevel = "medium";
      maxOutputTokens = 2048;

    } else if (isComplex && isCoding) {

      selectedModel = "gemini-3.6-flash";
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
      thinkingLevel = "minimal";
      maxOutputTokens = 768;

    } else {

      /*
        DEFAULT = FASTEST
      */

      selectedModel = "gemini-3.1-flash-lite";
      thinkingLevel = "minimal";
      maxOutputTokens = 512;
    }

    /*
      FALLBACK

      If the selected model is unavailable,
      HAIVA automatically tries lighter models.
    */

    const fallbackModels = [
      selectedModel,
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite"
    ];

    const models = [...new Set(fallbackModels)];

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
Your response will often be converted to speech.
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

    let lastError = null;

    for (const model of models) {

      try {

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" +
            model +
            ":generateContent?key=" +
            apiKey,
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
                      text: message
                    }
                  ]
                }
              ],

              generationConfig: {
                thinkingConfig: {
                  thinkingLevel: thinkingLevel
                },

                maxOutputTokens: maxOutputTokens
              }
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {

          lastError =
            data?.error?.message ||
            `Gemini returned ${response.status}`;

          console.error(
            "HAIVA model failed:",
            model,
            lastError
          );

          continue;
        }

        const reply =
          data?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();

        if (!reply) {

          lastError =
            "Gemini returned an empty response.";

          continue;
        }

        return res.status(200).json({
          reply,
          model,
          router: "automatic-speed"
        });

      } catch (error) {

        lastError = error.message;

        console.error(
          "HAIVA request failed:",
          model,
          error
        );
      }
    }

    return res.status(502).json({
      error:
        "HAIVA could not connect to an available Gemini model.",
      details: lastError
    });

  } catch (error) {

    console.error(
      "HAIVA server error:",
      error
    );

    return res.status(500).json({
      error: "Server error"
    });
  }
}
