import assert from "node:assert/strict";
import { test } from "node:test";
import { VoiceLifecycleV2, VOICE_LIFECYCLE_STATES } from "../core/voice/voice-lifecycle-coordinator.js";

test("V2 lifecycle: normal conversational voice path", () => {
  const lifecycle = new VoiceLifecycleV2();
  assert.equal(lifecycle.state, VOICE_LIFECYCLE_STATES.READY);
  assert.equal(lifecycle.isConversationActive(), false);
  assert.equal(lifecycle.activateListening(), true);
  assert.equal(lifecycle.isConversationActive(), true);
  assert.equal(lifecycle.beginThinking(), true);
  assert.equal(lifecycle.beginSpeaking(), true);
  assert.equal(lifecycle.returnToListening(), true);
  assert.equal(lifecycle.state, VOICE_LIFECYCLE_STATES.LISTENING);
  assert.equal(lifecycle.isConversationActive(), true);
});

test("V2 lifecycle: interrupt moves SPEAKING to THINKING without owning capture", () => {
  const lifecycle = new VoiceLifecycleV2();
  lifecycle.activateListening();
  lifecycle.beginThinking();
  lifecycle.beginSpeaking();
  assert.equal(lifecycle.interruptToThinking(), true);
  assert.equal(lifecycle.state, VOICE_LIFECYCLE_STATES.THINKING);
  assert.equal(lifecycle.isConversationActive(), true);
});

test("V2 lifecycle: invalid jumps are rejected", () => {
  const lifecycle = new VoiceLifecycleV2();
  assert.equal(lifecycle.beginSpeaking(), false);
  assert.equal(lifecycle.state, VOICE_LIFECYCLE_STATES.READY);
});

test("V2 boundary: lifecycle has no speech semantic decision API", () => {
  const lifecycle = new VoiceLifecycleV2();
  assert.equal("shouldEndConversation" in lifecycle, false);
  assert.equal("detectVoiceInterrupt" in lifecycle, false);
});

test("V2 session ends only when its owner explicitly ends the session", () => {
  const lifecycle = new VoiceLifecycleV2();
  lifecycle.activateListening();
  assert.equal(lifecycle.isConversationActive(), true);
  assert.equal(lifecycle.endSession(), true);
  assert.equal(lifecycle.state, VOICE_LIFECYCLE_STATES.READY);
  assert.equal(lifecycle.isConversationActive(), false);
});
