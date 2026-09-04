export async function runAutonomy({ observe, understand, plan, decide, execute, verify, remember, maxRetries = 2 } = {}) {
  for (const fn of [observe, understand, plan, decide, execute, verify]) if (typeof fn !== "function") throw new Error("Autonomy pipeline functions are required.");
  const observation = await observe();
  const understanding = await understand(observation);
  let currentPlan = await plan(understanding);
  let attempt = 0;
  while (true) {
    const decision = await decide(currentPlan, understanding);
    const result = await execute(decision);
    const verification = await verify(result, decision);
    if (verification?.passed) {
      if (typeof remember === "function") await remember({ observation, understanding, plan: currentPlan, decision, result, verification });
      return { status: "completed", observation, understanding, plan: currentPlan, decision, result, verification, attempts: attempt + 1 };
    }
    if (attempt >= maxRetries) return { status: "failed", observation, understanding, plan: currentPlan, decision, result, verification, attempts: attempt + 1 };
    attempt += 1;
    currentPlan = await plan({ ...understanding, previous: { plan: currentPlan, decision, result, verification }, retry: attempt });
  }
}
