// =========================================
// H.A.I.V.A. Assistant Controller
// =========================================

import { routeRequest } from "./router.js";

/**
 * Process a user request through H.A.I.V.A.
 *
 * UI and other modules can call this function
 * without needing to know how skills work.
 */
export async function processRequest(
  skillName,
  input
) {
  if (!skillName) {
    throw new Error(
      "Skill name is required."
    );
  }

  if (
    input === undefined ||
    input === null
  ) {
    throw new Error(
      "Request input is required."
    );
  }

  console.log(
    `H.A.I.V.A. processing: ${skillName}`
  );

  try {
    const result = await routeRequest(
      skillName,
      input
    );

    console.log(
      `H.A.I.V.A. completed: ${skillName}`
    );

    return result;

  } catch (error) {

    console.error(
      `H.A.I.V.A. request failed: ${skillName}`,
      error
    );

    throw error;
  }
}

console.log(
  "H.A.I.V.A. Assistant Controller loaded."
);
