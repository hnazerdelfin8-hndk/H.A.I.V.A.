// =========================================
// H.A.I.V.A. Application Loader
// =========================================

import {
  initializeHAIVA
} from "./initializer.js";

console.log("H.A.I.V.A. is starting...");

try {

  const result = initializeHAIVA();

  if (result?.ready) {

    console.log(
      "H.A.I.V.A. is ready."
    );

  } else {

    console.warn(
      "H.A.I.V.A. initialization incomplete."
    );

  }

} catch (error) {

  console.error(
    "H.A.I.V.A. startup failed:",
    error
  );

}
