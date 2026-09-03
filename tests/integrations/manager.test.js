import assert from "node:assert/strict";
import { createIntegrationManager } from "../../core/integrations/manager.js";

const calls = [];
const manager = createIntegrationManager({
  integrations: [
    {
      name: " GitHub ",
      description: "Repository integration.",
      risk: "controlled",
      health: async () => ({ healthy: true, service: "github" }),
      execute: async (input, context) => {
        calls.push({ input, context });
        return { ok: true, input, integration: context.integration };
      }
    },
    {
      name: "local-read",
      risk: "safe",
      execute: async input => ({ value: input })
    }
  ]
});

assert.deepEqual(manager.list(), [
  { name: "github", description: "Repository integration.", risk: "controlled" },
  { name: "local-read", description: "", risk: "safe" }
]);
assert.equal(manager.get("GITHUB").name, "github");

const health = await manager.check("github");
assert.deepEqual(health, {
  name: "github",
  healthy: true,
  checked: true,
  detail: { healthy: true, service: "github" }
});

const result = await manager.execute("github", { operation: "read" }, { requestId: "stage3-test" });
assert.deepEqual(result, { ok: true, input: { operation: "read" }, integration: "github" });
assert.deepEqual(calls[0].context, {
  requestId: "stage3-test",
  integration: "github",
  risk: "controlled"
});

assert.deepEqual(await manager.execute("LOCAL-READ", "hello"), { value: "hello" });
assert.deepEqual(await manager.check("local-read"), {
  name: "local-read",
  healthy: true,
  checked: false
});

assert.throws(
  () => manager.register({ name: "github", execute: () => null }),
  /already registered/
);
assert.throws(
  () => manager.register({ name: "bad", risk: "unsafe", execute: () => null }),
  /Invalid risk level/
);
assert.throws(
  () => manager.register({ name: "broken" }),
  /executor is required/
);
await assert.rejects(() => manager.execute("missing", null), /Integration not found/);
await assert.rejects(() => manager.check("missing"), /Integration not found/);

console.log("PASS: HAIVA Stage 3 Integration Manager tests");
