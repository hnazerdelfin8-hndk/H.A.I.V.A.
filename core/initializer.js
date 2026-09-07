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
    // Optional skills may degrade startup, but they must not silently become
    // a fatal core failure. The core initialization contract is explicit.
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
    const message = error?.message || String(error || "Unknown initialization error");
    try {
      window.dispatchEvent(new CustomEvent("haiva:boot-failure", {
        detail: { stage: "INITIALIZER_FAILED", message }
      }));
    } catch (dispatchError) {
      console.warn("[HAIVA-BOOT] Failed to dispatch initializer failure:", dispatchError);
    }
    // Never convert a core initialization failure into READY.
    throw error;
  }
}
