// =========================================
// H.A.I.V.A. INITIALIZER
// =========================================

import { CONFIG } from "./config.js";
import { registerDefaultSkills } from "./skill-manager.js";
import { confirmCoreBootReady } from "./boot-ready.js";

let initialized = false;

export async function initializeHAIVA() {
  if (initialized) {
    confirmCoreBootReady({ alreadyInitialized: true });
    return { ready: true, alreadyInitialized: true };
  }

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

    const result = {
      ready: true,
      degraded: warnings.length > 0,
      warnings,
      version: CONFIG.app.version
    };

    // Explicit boot success boundary. Runtime READY remains owned by app.js.
    confirmCoreBootReady({ degraded: result.degraded, version: result.version });
    return result;
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
