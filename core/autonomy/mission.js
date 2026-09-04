const clone = value => structuredClone(value);

export function createMission(goal, steps = []) { if (!goal) throw new Error("Mission goal is required."); return { id: crypto.randomUUID(), goal, steps: steps.map((description, index) => ({ id: `${index + 1}`, description, status: "pending" })), status: "active", progress: 0 }; }

export function nextMissionStep(mission) { return mission.steps.find(step => step.status === "pending") ?? null; }

export function updateMission(mission, stepId, status) { const step = mission.steps.find(item => item.id === stepId); if (!step) throw new Error("Unknown mission step."); step.status = status; mission.progress = mission.steps.length ? mission.steps.filter(item => item.status === "completed").length / mission.steps.length : 1; if (mission.progress === 1) mission.status = "completed"; return clone(mission); }

export function createTaskQueue() { const tasks = []; return { add(task) { tasks.push({ ...clone(task), status: "pending" }); return clone(tasks.at(-1)); }, next() { return clone(tasks.find(task => task.status === "pending") ?? null); }, complete(id) { const task = tasks.find(item => item.id === id); if (!task) throw new Error("Unknown task."); task.status = "completed"; return clone(task); }, snapshot() { return clone(tasks); } }; }

export function replanMission(mission, remainingSteps) { return { ...clone(mission), steps: remainingSteps.map((description, index) => ({ id: `r${index + 1}`, description, status: "pending" })), status: "active" }; }
