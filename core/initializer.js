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


// -----------------------------------------
// Load H.A.I.V.A. UI
// -----------------------------------------

async function loadUI() {
  const app = document.getElementById("haiva-app");

  if (!app) {
    throw new Error(
      "H.A.I.V.A. application root not found."
    );
  }

  const response = await fetch("./ui/ui.html");

  if (!response.ok) {
    throw new Error(
      "Failed to load H.A.I.V.A. UI."
    );
  }

  app.innerHTML = await response.text();

  const css = document.createElement("link");

  css.rel = "stylesheet";
  css.href = "./ui/ui.css";

  document.head.appendChild(css);

  await import("../ui/ui.js");
  await import("./ui-bridge.js");
}


// -----------------------------------------
// Initialize H.A.I.V.A.
// -----------------------------------------

export async function initializeHAIVA() {

  console.log(
    "Initializing H.A.I.V.A..."
  );

  await loadUI();

  // Register Chat Skill
  registerSkill(
    "chat",
    chatSkill
  );

  // Confirm Router
  if (typeof routeRequest !== "function") {
    throw new Error(
      "H.A.I.V.A. router is not available."
    );
  }

  console.log(
    "H.A.I.V.A. initialization complete."
  );

  return {
    ready: true
  };
}
