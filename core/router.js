// H.A.I.V.A. Request Router

import { getSkill } from "./skill-manager.js";

/**
 * Route a request to the appropriate skill.
 */
export async function routeRequest(skillName, input) {
  if (!skillName) {
    throw new Error("Skill name is required.");
  }

  const skill = getSkill(skillName);

  if (!skill) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  if (typeof skill.execute !== "function") {
    throw new Error(
      `Skill "${skillName}" does not have an execute function.`
    );
  }

  return await skill.execute(input);
}
