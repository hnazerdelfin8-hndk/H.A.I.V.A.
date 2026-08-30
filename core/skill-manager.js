// H.A.I.V.A. Skill Manager

const skills = new Map();

/**
 * Register a skill
 */
export function registerSkill(name, skill) {
  if (!name || !skill) {
    throw new Error("Invalid skill registration.");
  }

  if (skills.has(name)) {
    throw new Error(`Skill already registered: ${name}`);
  }

  skills.set(name, skill);

  console.log(`H.A.I.V.A. skill registered: ${name}`);
}

/**
 * Get a registered skill
 */
export function getSkill(name) {
  return skills.get(name) || null;
}

/**
 * Check if a skill exists
 */
export function hasSkill(name) {
  return skills.has(name);
}

/**
 * Get all registered skills
 */
export function getSkills() {
  return Array.from(skills.keys());
}

/**
 * Remove a skill
 */
export function unregisterSkill(name) {
  if (!skills.has(name)) {
    return false;
  }

  skills.delete(name);

  console.log(`H.A.I.V.A. skill removed: ${name}`);

  return true;
}
