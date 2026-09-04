import assert from "node:assert/strict";
import { createMission, nextMissionStep, updateMission, createTaskQueue, replanMission } from "../../core/autonomy/mission.js";
import { createHealthMonitor, diagnoseHealth, proposeUpgrade, evaluateUpgrade, adoptUpgrade, rollbackUpgrade } from "../../core/autonomy/self-improvement.js";
import { classifyAction, requiresApproval, authorize, createAuditLog, createEmergencyStop } from "../../core/autonomy/oversight.js";

const mission = createMission("ship HAIVA", ["inspect", "verify"]); assert.equal(nextMissionStep(mission).id, "1"); updateMission(mission, "1", "completed"); updateMission(mission, "2", "completed"); assert.equal(mission.status, "completed");
const queue = createTaskQueue(); queue.add({ id: "q1" }); assert.equal(queue.next().id, "q1"); queue.complete("q1"); assert.equal(queue.next(), null); assert.equal(replanMission(mission, ["recover"]).steps[0].description, "recover");
const monitor = createHealthMonitor(); monitor.record({ level: "info", event: "ok" }); assert.equal(diagnoseHealth(monitor).healthy, true); monitor.record({ level: "critical", event: "fault" }); assert.equal(monitor.healthy(), false);
const proposal = proposeUpgrade({ goal: "better skill", scope: "skill" }, { version: 1 }); const verified = evaluateUpgrade(proposal, { passed: true }); assert.equal(verified.status, "verified"); const adopted = adoptUpgrade(verified, { approved: true }); assert.equal(adopted.status, "adopted"); assert.equal(rollbackUpgrade(adopted).status, "rolled_back");
const action = classifyAction({ category: "self_modification" }); assert.equal(requiresApproval(action), true); assert.equal(authorize(action).allowed, false); assert.equal(authorize(action, { approved: true }).allowed, true);
const audit = createAuditLog(); audit.record({ action: "test" }); assert.equal(audit.snapshot().length, 1); const stop = createEmergencyStop(); stop.stop(); assert.equal(stop.isStopped(), true); stop.resume({ approved: true }); assert.equal(stop.isStopped(), false);
console.log("PASS: Stage 10A-10H Full Autonomous H.A.I.V.A. verification");
