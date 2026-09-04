import assert from "node:assert/strict";
import { createExternalToolRegistry, authorizeAction, createWebResearchAdapter, createFileDocumentAdapter, createProductivityQueue, createBusinessWorkflow } from "../../core/tools/real-world.js";

const registry = createExternalToolRegistry();
registry.register({ id: "notify", scope: "notify", scopes: ["notify"], risk: "low", execute: async input => ({ sent: input }) });
assert.equal((await registry.run("notify", "hello")).sent, "hello");
assert.throws(() => authorizeAction({ id: "danger", risk: "high" }));
assert.equal(authorizeAction({ id: "danger", risk: "high" }, { approved: true }), true);
const research = createWebResearchAdapter(async () => ({ status: 200, ok: true, text: async () => "source" }));
assert.equal((await research("https://example.test")).text, "source");
const memory = new Map(); const files = createFileDocumentAdapter({ readFile: async f => memory.get(f), writeFile: async (f,d) => memory.set(f,d) });
await files.write("a.txt", "ok"); assert.equal(await files.read("a.txt"), "ok");
const queue = createProductivityQueue(); queue.add({ id: "t1" }); assert.equal(queue.next().id, "t1");
const workflow = createBusinessWorkflow([x => x + 1, async x => x * 2]); assert.equal(await workflow.run(2), 6);
console.log("PASS: Stage 8A-8H Real-World Tools verification");
