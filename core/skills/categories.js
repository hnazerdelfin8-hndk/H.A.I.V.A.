// =========================================
// H.A.I.V.A. SKILLS — SKILL CATEGORIES
// =========================================

export const SKILL_CATEGORIES = Object.freeze([
  "weather",
  "web_search",
  "calendar",
  "reminder",
  "notes",
  "music",
  "phone_control",
  "computer_control",
  "email",
  "finance",
  "business",
  "social_media",
  "content_creation",
  "va_assistant",
  "automation"
]);

export function isSkillCategory(name) {
  return SKILL_CATEGORIES.includes(String(name || "").toLowerCase());
}
