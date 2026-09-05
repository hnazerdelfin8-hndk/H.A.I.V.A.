import test from "node:test";
import assert from "node:assert/strict";
import { classifyPhoneCommand } from "../core/phone-capabilities.js";

test("classifies battery requests", () => {
  assert.deepEqual(classifyPhoneCommand("What is my battery level?"), { action: "battery" });
});

test("classifies device information requests", () => {
  assert.deepEqual(classifyPhoneCommand("What phone am I using?"), { action: "device-info" });
});

test("classifies supported app launch requests", () => {
  assert.deepEqual(classifyPhoneCommand("Open YouTube"), { action: "open-app", app: "youtube" });
});

test("does not classify unrelated AI requests as phone actions", () => {
  assert.equal(classifyPhoneCommand("Explain quantum computing"), null);
});
