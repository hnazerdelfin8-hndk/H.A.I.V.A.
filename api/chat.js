// =========================================
// H.A.I.V.A. AI CHAT API
// =========================================

export default async function handler(req, res) {

  // ---------------------------------------
  // CORS / METHOD
  // ---------------------------------------

  if (req.method !== "POST") {

    return res.status(405).json({
      response: "Method not allowed."
    });

  }


  // ---------------------------------------
  // GET MESSAGE
  // ---------------------------------------

  const message =
    req.body?.message;


  if (
    typeof message !== "string" ||
    !message.trim()
  ) {

    return res.status(400).json({
      response: "Please provide a message."
    });

  }


  // ---------------------------------------
  // API KEY
  // ---------------------------------------

  const apiKey =
    process.env.GEMINI_API_KEY;


  if (!apiKey) {

    console.error(
      "GEMINI_API_KEY is not configured."
    );


    return res.status(500).json({
      response:
        "My AI connection is not configured yet, Master."
    });

  }


  // ---------------------------------------
  // GEMINI REQUEST
  // ---------------------------------------

  try {

    const response =
      await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({

              system_instruction: {

                parts: [

                  {
                    text:
                      `You are H.A.I.V.A., an intelligent voice assistant.

Address the user as "Master".

Be helpful, concise, natural, and conversational.

You are primarily a voice assistant, so responses should normally be easy to understand when spoken aloud.

Do not describe yourself as a chatbot unless specifically asked.

If the user speaks Filipino or Taglish, respond naturally in Filipino or Taglish.

Do not use unnecessary markdown in normal voice responses.`

                  }

                ]

              },

              contents: [

                {

                  role: "user",

                  parts: [

                    {
                      text:
                        message.trim()
                    }

                  ]

                }

              ],

              generationConfig: {

                temperature: 0.7,

                maxOutputTokens: 512

              }

            })

        }
      );


    // ---------------------------------------
    // HANDLE AI ERROR
    // ---------------------------------------

    if (!response.ok) {

      const errorText =
        await response.text();


      console.error(
        "Gemini API error:",
        response.status,
        errorText
      );


      return res.status(502).json({

        response:
          "I'm having trouble reaching my AI system right now, Master."

      });

    }


    // ---------------------------------------
    // READ RESPONSE
    // ---------------------------------------

    const data =
      await response.json();


    const answer =
      data?.candidates?.[0]
        ?.content?.parts?.[0]
        ?.text;


    if (!answer) {

      console.error(
        "Gemini returned no text.",
        data
      );


      return res.status(502).json({

        response:
          "I received an empty response from my AI system, Master."

      });

    }


    // ---------------------------------------
    // RETURN TO H.A.I.V.A.
    // ---------------------------------------

    return res.status(200).json({

      response:
        answer.trim()

    });


  } catch (error) {

    console.error(
      "H.A.I.V.A. AI request failed:",
      error
    );


    return res.status(500).json({

      response:
        "Something went wrong while connecting to my AI system, Master."

    });

  }

}
