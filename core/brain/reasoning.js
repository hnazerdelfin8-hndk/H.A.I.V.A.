// =========================================
// H.A.I.V.A. BRAIN — REASONING LAYER
// =========================================

export function prepareReasoning(input, context = []) {
  const text = String(input || "").trim();
  const history = Array.isArray(context) ? context : [];
  const recent = history.slice(-8);

  const referencesContext = /\b(ito|iyan|yun|iyon|that|it|this|these|those|earlier|kanina|previous|continue)\b/i.test(text);

  return {
    input: text,
    context: recent,
    referencesContext,
    hasContext: recent.length > 0
  };
}

export function shouldClarify(reasoning) {
  if (!reasoning?.input) return true;
  return reasoning.referencesContext && !reasoning.hasContext;
}
