// =========================================
// H.A.I.V.A. AGENT — APPROVAL GATES
// =========================================

const LEVELS = Object.freeze({ SAFE: "safe", CONTROLLED: "controlled", APPROVAL: "approval" });

export function classifyAction(action = {}) {
  const type = String(action.type || action.name || "").toLowerCase();
  if (["read", "inspect", "analyze", "plan", "test", "diagnose", "report"].includes(type)) return LEVELS.SAFE;
  if (["write", "modify", "create", "install", "commit", "pull_request", "preview_deploy"].includes(type)) return LEVELS.CONTROLLED;
  if (["production_deploy", "delete", "destructive_delete", "database_migration", "credential_change"].includes(type)) return LEVELS.APPROVAL;
  return LEVELS.CONTROLLED;
}

export function requiresApproval(action) {
  return classifyAction(action) === LEVELS.APPROVAL;
}

export function canExecute(action, { approved = false } = {}) {
  const level = classifyAction(action);
  return level !== LEVELS.APPROVAL || approved === true;
}

export { LEVELS };
