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
      HAIVA AUTOMATIC MODEL ROUTER

      Simple / fast:
      Gemini 3.1 Flash-Lite

      VA / high-volume:
      Gemini 3.5 Flash-Lite

      Coding / technical:
      Gemini 3.5 Flash

      Complex reasoning:
      Gemini 3.6 Flash

      Very difficult coding / agentic work:
      Gemini 3.7 Flash
    */

    let selectedModel = "gemini-3.1-flash-lite";
    let thinkingLevel = "minimal";

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
      "next.js",
      "backend",
      "frontend",
      "database",
      "debug",
      "debugging",
      "bug",
      "error",
      "programming",
      "script",
      "function",
      "algorithm"
    ];

    const complexWords = [
      "solve",
      "solution",
      "analyze",
      "analysis",
      "reason",
      "reasoning",
      "complex",
      "architecture",
      "design",
      "strategy",
      "optimize",
      "optimization",
      "compare",
      "calculate",
      "mathematical",
      "logic",
      "diagnose",
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
      "agent",
      "multi-step",
      "architecture",
      "production system",
      "large codebase",
      "refactor entire",
      "advanced coding"
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
      "content",
      "caption",
      "spreadsheet",
      "data entry",
      "research",
      "virtual assistant",
      "va task",
      "task",
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

    const isVeryComplex = containsAny(veryComplexWords);
    const isCoding = containsAny(codingWords);
    const isComplex = containsAny(complexWords);
    const isVA = containsAny(vaWords);

    /*
      Choose model automatically.
    */

    if (isVeryComplex && isCoding) {

      selectedModel = "gemini-3.7-flash";
      thinkingLevel = "medium";

    } else if (isComplex && isCoding) {

      selectedModel = "gemini-3.6-flash";
      thinkingLevel = "medium";

    } else if (isCoding) {

      selectedModel = "gemini-3.5-flash";
      thinkingLevel = "low";

    } else if (isComplex) {

      selectedModel = "gemini-3.6-flash";
      thinkingLevel = "medium";

    } else if (isVA) {

      selectedModel = "gemini-3.5-flash-lite";
      thinkingLevel = "minimal";

    } else {

      selectedModel = "gemini-3.1-flash-lite";
      thinkingLevel = "minimal";
    }

    /*
      Automatic fallback.

      If the selected model is unavailable,
      HAIVA tries the next appropriate model.
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

You are a practical AI assistant designed to help the user
with virtual assistant work, productivity, research,
customer support, email management, calendar management,
social media tasks, coding, automation, websites,
GitHub, Vercel, Supabase and general problem solving.

CORE BEHAVIOR:
- Be fast.
- Be accurate.
- Be practical.
- Solve problems instead of only explaining them.
- Give the user the next useful action.
- Avoid unnecessary repetition.
- For simple questions, answer concisely.
- For difficult problems, reason carefully before answering.
- Never claim that you performed an action unless you actually did.
- Never invent passwords, API keys, credentials or results.

LANGUAGE:
- The user may speak English, Tagalog or Taglish.
- Respond naturally in the user's language.
- For Tagalog, use natural conversational Filipino.
- Avoid stiff or literal machine translation.
- Sound like a natural human assistant.
- Keep answers easy to understand when spoken aloud.

VOICE:
Your responses may be converted into speech.
Prefer natural sentences.
Avoid unnecessary markdown, tables and excessive formatting
when the answer is intended to be spoken.

VA ASSISTANT:
Help with:
- Email management
- Customer support
- Calendar management
- Social media management
- Research
- Data entry
- Client communication
- Writing and rewriting
- Task management
- Automation
- Coding and debugging

TROUBLESHOOTING:
When the user reports an error:
1. Identify the likely cause.
2. Explain it simply.
3. Give the exact fix.
4. Tell the user what to do next.

You are HAIVA, the user's practical AI VA copilot.
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
                maxOutputTokens: 2048
              }
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {

          lastError =
            data?.error?.message ||
            `Gemini returned HTTP ${response.status}`;

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
          router: "automatic"
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
