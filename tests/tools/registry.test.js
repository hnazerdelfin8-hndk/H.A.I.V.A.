import assert from "node:assert/strict";
import {
  registerTool,
  getTool,
  hasTool,
  listTools,
  executeTool,
  unregisterTool,
  clearTools
} from "../../core/tools/registry.js";

clearTools();

let calls = 0;

const registered = registerTool({
  name: " Echo ",
  description: "Returns the supplied value.",
  risk: "safe",
  input: { type: "string" },
  execute: async (input, context) => {
    calls += 1;
    return { value: input, requestId: context.requestId };
  }
});

assert.equal(registered.name, "echo");
assert.equal(getTool("ECHO").description, "Returns the supplied value.");
assert.equal(hasTool("echo"), true);
assert.equal(hasTool("missing"), false);

const listed = listTools();
assert.equal(listed.length, 1);
assert.equal(listed[0].name, "echo");
assert.equal("execute" in listed[0], false);
assert.equal(listed[0].risk, "safe");

const result = await executeTool("Echo", "hello", { requestId: "test-1" });
assert.deepEqual(result, { value: "hello", requestId: "test-1" });
assert.equal(calls, 1);

assert.throws(
  () => registerTool({ name: "echo", execute: () => null }),
  /already registered/
);
assert.throws(
  () => registerTool({ name: "broken", risk: "unsafe", execute: () => null }),
  /Invalid risk level/
);
assert.throws(
  () => registerTool({ name: "no-executor" }),
  /execute function/
);
await assert.rejects(
  executeTool("missing", null),
  /not registered/
);

assert.equal(unregisterTool("ECHO"), true);
assert.equal(hasTool("echo"), false);
assert.equal(unregisterTool("echo"), false);

console.log("PASS: HAIVA Phase 3 Tool Registry tests");
