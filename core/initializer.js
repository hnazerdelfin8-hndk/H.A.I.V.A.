// =========================================
// H.A.I.V.A. INITIALIZER
// =========================================

import { CONFIG } from "./config.js";
import { registerDefaultSkills } from "./skill-manager.js";

let initialized = false;

export async function initializeHAIVA() {
  if (initialized) return { ready: true, alreadyInitialized: true };

  console.log(`Starting ${CONFIG.app.name} v${CONFIG.app.version}...`);

  const warnings = [];

  try {
    // Optional skills must never prevent the core conversation UI from booting.
    try {
      registerDefaultSkills();
    } catch (error) {
      console.error("H.A.I.V.A. optional skill registration failed:", error);
      warnings.push(error);
    }

    initialized = true;
    console.log("H.A.I.V.A. core initialization complete.");

    return {
      ready: true,
      degraded: warnings.length > 0,
      warnings,
      version: CONFIG.app.version
    };
  } catch (error) {
    console.error("H.A.I.V.A. initialization failed:", error);
    // Core boot is intentionally resilient: the chat/voice shell can still
    // operate and report backend errors without getting stuck on Initializing.
    initialized = true;
    return { ready: true, degraded: true, warnings: [error], version: CONFIG.app.version };
  }
}
