import assert from "node:assert/strict";
import { test } from "node:test";
import { decideVoiceControl } from "../core/brain/decision.js";

test("Brain classifies goodbye as a response followed by conversation end", () => {
  const decision = decideVoiceControl("goodbye", { phase: "LISTENING" });
  assert.equal(decision.action, "respond");
  assert.equal(decision.intent, "end_conversation");
  assert.equal(decision.endConversation, true);
});

test("Brain classifies stop plus instruction as an interruption", () => {
  const decision = decideVoiceControl("Stop, gumawa ka ng summary", { phase: "SPEAKING" });
  assert.equal(decision.action, "interrupt");
  assert.equal(decision.intent, "interrupt");
  assert.equal(decision.endConversation, false);
  assert.equal(decision.instruction, "gumawa ka ng summary");
});

test("Brain does not treat an ordinary wait sentence as an interruption", () => {
  const decision = decideVoiceControl("the wait time is three seconds", { phase: "SPEAKING" });
  assert.equal(decision.action, "respond");
  assert.equal(decision.endConversation, false);
});
