import test from "node:test";
import assert from "node:assert/strict";
import { VoiceSessionManager } from "../core/voice/session-manager.js";
import { VoiceTurnFence } from "../core/voice/turn-fence.js";

test("session manager rejects stale session events", () => {
  const sessions = new VoiceSessionManager();
  const first = sessions.start();
  assert.equal(sessions.accept({ sessionId: first }), true);
  sessions.end();
  const second = sessions.start();
  assert.notEqual(second, first);
  assert.equal(sessions.accept({ sessionId: first }), false);
  assert.equal(sessions.accept({ sessionId: second }), true);
});

test("turn fence rejects previous-turn callbacks", () => {
  const fence = new VoiceTurnFence();
  const first = fence.begin();
  assert.equal(fence.accept(first), true);
  const second = fence.begin();
  assert.notEqual(second, first);
  assert.equal(fence.accept(first), false);
  assert.equal(fence.accept(second), true);
});

test("invalidated turn rejects late callbacks", () => {
  const fence = new VoiceTurnFence();
  const turn = fence.begin();
  fence.invalidate();
  assert.equal(fence.accept(turn), false);
});
