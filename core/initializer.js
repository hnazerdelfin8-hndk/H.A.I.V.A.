// =========================================
// H.A.I.V.A. INITIALIZER
// =========================================

import { CONFIG } from "./config.js";
import {
  registerDefaultSkills
} from "./skill-manager.js";


let initialized = false;


export async function initializeHAIVA() {

  if (initialized) {

    return {
      ready: true,
      alreadyInitialized: true
    };

  }


  console.log(
    `Starting ${CONFIG.app.name} v${CONFIG.app.version}...`
  );


  try {

    registerDefaultSkills();

    initialized = true;


    console.log(
      "H.A.I.V.A. initialization complete."
    );


    return {
      ready: true,
      version: CONFIG.app.version
    };

  } catch (error) {

    console.error(
      "H.A.I.V.A. initialization failed:",
      error
    );


    return {
      ready: false,
      error
    };

  }

}
