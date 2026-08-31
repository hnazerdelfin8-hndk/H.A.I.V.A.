// =========================================
// H.A.I.V.A. ASSISTANT CONTROLLER
// =========================================

import { CONFIG } from "./config.js";

import {
  routeRequest
} from "./router.js";

import {
  setUIState,
  speak
} from "./ui-bridge.js";


export class HAIVAAssistant {

  constructor() {

    this.processing = false;

  }


  async respond(
    command
  ) {

    if (
      this.processing
    ) {

      return null;

    }


    const text =
      String(command)
        .trim();


    if (!text) {

      return null;

    }


    this.processing = true;


    try {

      setUIState(
        "THINKING"
      );


      const result =
        await routeRequest(
          text
        );


      if (
        !result ||
        !result.response
      ) {

        throw new Error(
          "No response received."
        );

      }


      setUIState(
        "SPEAKING"
      );


      await speak(
        result.response
      );


      return result.response;

    } catch (error) {

      console.error(
        "Assistant response failed:",
        error
      );


      const fallback =
        CONFIG.assistant
          .fallbackResponse;


      setUIState(
        "SPEAKING"
      );


      await speak(
        fallback
      );


      return fallback;

    } finally {

      this.processing = false;

    }

  }

}
