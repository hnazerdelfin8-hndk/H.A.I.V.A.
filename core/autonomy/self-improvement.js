const clone = value => structuredClone(value);

export function createHealthMonitor() { const events = []; return { record(event) { events.push({ ...clone(event), at: new Date().toISOString() }); }, snapshot() { return clone(events); }, healthy() { return !events.some(event => event.level === "critical"); } }; }

export function diagnoseHealth(monitor) { const events = monitor.snapshot(); const critical = events.filter(event => event.level === "critical"); return { healthy: critical.length === 0, critical, count: events.length }; }

export function proposeUpgrade(request, current = {}) { if (!request?.goal) throw new Error("Upgrade goal is required."); return { id: crypto.randomUUID(), goal: request.goal, scope: request.scope ?? "capability", current: clone(current), plan: request.plan ?? ["inspect", "design", "implement", "test", "verify"], status: "proposed" }; }

export function evaluateUpgrade(upgrade, verification) { if (!upgrade?.id) throw new Error("Upgrade proposal is required."); return { ...clone(upgrade), verification: clone(verification), status: verification?.passed === true ? "verified" : "rejected" }; }

export function adoptUpgrade(upgrade, approval = {}) { if (upgrade?.status !== "verified") throw new Error("Only verified upgrades may be adopted."); if (approval.approved !== true) throw new Error("Master approval required for upgrade adoption."); return { ...clone(upgrade), status: "adopted", adoptedAt: new Date().toISOString() }; }

export function rollbackUpgrade(upgrade) { if (!upgrade || !["adopted", "verified"].includes(upgrade.status)) throw new Error("Upgrade is not rollback eligible."); return { ...clone(upgrade), status: "rolled_back", rolledBackAt: new Date().toISOString() }; }
