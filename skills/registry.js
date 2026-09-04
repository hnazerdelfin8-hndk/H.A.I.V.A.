// =========================================
// H.A.I.V.A. CANONICAL SKILL REGISTRY
// Layer 8: Automation + Skills
// =========================================

import { webSearch } from "../core/skills/web-search.js";
import { weather } from "../core/skills/weather.js";
import { reminder } from "../core/skills/reminder.js";
import { notes } from "../core/skills/notes.js";
import { music } from "../core/skills/music.js";

export const SKILL_REGISTRY = Object.freeze({
  weather,
  web_search: webSearch,
  reminder,
  notes,
  music
});

export function getCanonicalSkills() {
  return Object.keys(SKILL_REGISTRY);
}

export function getCanonicalSkill(name) {
  return SKILL_REGISTRY[String(name || "").toLowerCase()] || null;
}
