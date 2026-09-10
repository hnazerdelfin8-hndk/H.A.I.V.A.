import assert from "node:assert/strict";
import { test } from "node:test";
import { VoiceLifecycleV2, VOICE_LIFECYCLE_STATES } from "../core/voice/v2/lifecycle-coordinator.js";

test("V2 lifecycle: normal conversational voice path", () => {
  const lifecycle = new VoiceLifecycleV2();
  assert.equal(lifecycle.state, VOICE_LIFECYCLE_STATES.READY);
  assert.equal(lifecycle.activateListening(), true);
  assert.equal(lifecycle.beginThinking(), true);
  assert.equal(lifecycle.beginSpeaking(), true);
  assert.equal(lifecycle.returnToListening(), true);
  assert.equal(lifecycle.state, VOICE_LIFECYCLE_STATES.LISTENING);
});

test("V2 lifecycle: interrupt moves SPEAKING to THINKING without owning capture", () => {
  const lifecycle = new VoiceLifecycleV2();
  lifecycle.activateListening();
  lifecycle.beginThinking();
  lifecycle.beginSpeaking();
  assert.equal(lifecycle.interruptToThinking(), true);
  assert.equal(lifecycle.state, VOICE_LIFECYCLE_STATES.THINKING);
});

test("V2 lifecycle: invalid jumps are rejected", () => {
  const lifecycle = new VoiceLifecycleV2();
  assert.equal(lifecycle.beginSpeaking(), false);
  assert.equal(lifecycle.state, VOICE_LIFECYCLE_STATES.READY);
});
