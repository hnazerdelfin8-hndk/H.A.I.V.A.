// =========================================
// H.A.I.V.A. BRAIN — DECISION MAKING
// =========================================

export function decide(intent, skills = []) {
  const available = new Set(Array.isArray(skills) ? skills.map(String) : []);

  if (intent?.name && available.has(intent.name)) {
    return { action: "skill", skill: intent.name, confidence: intent.confidence || 0 };
  }

  return { action: "ai", skill: null, confidence: intent?.confidence || 0 };
}
