const clone = value => structuredClone(value);

const HIGH_RISK = new Set(["financial", "credential", "destructive", "external_write", "self_modification"]);

export function classifyAction(action) { return { ...clone(action), risk: action?.risk ?? (HIGH_RISK.has(action?.category) ? "high" : "low") }; }
export function requiresApproval(action) { return classifyAction(action).risk === "high"; }
export function authorize(action, approval = {}) { const normalized = classifyAction(action); if (requiresApproval(normalized) && approval.approved !== true) return { allowed: false, reason: "approval_required" }; return { allowed: true, action: normalized }; }
export function createAuditLog() { const entries = []; return { record(event) { entries.push({ ...clone(event), at: new Date().toISOString() }); }, snapshot() { return clone(entries); } }; }
export function createEmergencyStop() { let stopped = false; return { stop() { stopped = true; }, resume(approval = {}) { if (approval.approved !== true) throw new Error("Approval required to resume."); stopped = false; }, isStopped() { return stopped; } }; }
