// =========================================
// H.A.I.V.A. REQUEST ROUTER
// =========================================

import { CONFIG } from "./config.js";

import {
  executeSkill
} from "./skill-manager.js";


export async function routeRequest(
  input
) {

  if (!input) {

    return {
      success: false,
      source: "router",
      response: ""
    };

  }


  const message =
    String(input).trim();


  if (!message) {

    return {
      success: false,
      source: "router",
      response: ""
    };

  }


  console.log(
    "H.A.I.V.A. Router:",
    message
  );


  // =======================================
  // LOCAL SKILLS
  // =======================================

  try {

    const skillResponse =
      await executeSkill(
        message
      );


    if (
      skillResponse !== null &&
      skillResponse !== undefined &&
      skillResponse !== ""
    ) {

      return {

        success: true,

        source: "skill",

        response:
          String(skillResponse)

      };

    }

  } catch (error) {

    console.error(
      "Skill routing failed:",
      error
    );

  }


  // =======================================
  // AI BACKEND
  // =======================================

  if (
    !CONFIG.features.chat
  ) {

    return {

      success: false,

      source: "router",

      response:
        CONFIG.assistant.fallbackResponse

    };

  }


  try {

    const response =
      await fetch(
        CONFIG.api.chatEndpoint,
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              message
            })

        }
      );


    if (!response.ok) {

      throw new Error(
        `AI server returned ${response.status}`
      );

    }


    const data =
      await response.json();


    const answer =
      data.response ||
      data.message;


    if (!answer) {

      throw new Error(
        "AI returned an empty response."
      );

    }


    return {

      success: true,

      source: "ai",

      response:
        String(answer)

    };

  } catch (error) {

    console.error(
      "AI request failed:",
      error
    );


    return {

      success: false,

      source: "error",

      response:
        CONFIG.assistant.connectionError

    };

  }

}
