// =========================================
// H.A.I.V.A. System Initializer
// =========================================

import {
  registerSkill
} from "./skill-manager.js";

import {
  routeRequest
} from "./router.js";

import * as chatSkill from "../skills/chat/index.js";

import {
  setStatus,
  setReply,
  setTranscript,
  resetUI
} from "../ui/ui.js";


// -----------------------------------------
// Initialize H.A.I.V.A.
// -----------------------------------------

export function initializeHAIVA() {

  console.log("Initializing H.A.I.V.A...");

  // Reset UI to its default state
  resetUI();

  // Register Chat Skill
  registerSkill("chat", chatSkill);

  // Confirm router is available
  if (typeof routeRequest !== "function") {
    throw new Error(
      "H.A.I.V.A. router is not available."
    );
  }

  // System ready
  setStatus("Ready");

  setTranscript(
    'Say "Yo HAIVA" to begin.'
  );

  setReply(
    "Standing by."
  );

  console.log(
    "H.A.I.V.A. initialization complete."
  );

  return {
    ready: true
  };
}
