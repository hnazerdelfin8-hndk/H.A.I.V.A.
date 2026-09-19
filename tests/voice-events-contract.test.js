import assert from "node:assert/strict";
import { test } from "node:test";
import { VOICE_EVENTS, createVoiceEvent, normalizeVoiceEvent } from "../core/voice/contracts/events.js";

test("voice event contract exposes canonical lifecycle event types", () => {
  assert.deepEqual(Object.keys(VOICE_EVENTS), [
    "VOICE_STARTED",
    "VOICE_TRANSCRIPT",
    "VOICE_PROCESSING",
    "VOICE_SPEAKING",
    "VOICE_BARGE_IN",
    "VOICE_CANCELLED",
    "VOICE_ERROR",
    "VOICE_RECOVERED"
  ]);
});

test("voice event payload has the canonical envelope", () => {
  const event = createVoiceEvent(VOICE_EVENTS.VOICE_BARGE_IN, {
    sessionId: "session-1",
    turn: 7,
    source: "duplex",
    timestamp: 123,
    data: { text: "stop" }
  });

  assert.deepEqual(event, {
    type: "VOICE_BARGE_IN",
    sessionId: "session-1",
    turn: 7,
    source: "duplex",
    timestamp: 123,
    data: { text: "stop" }
  });
  assert.equal(Object.isFrozen(event), true);
});

test("voice event normalization rejects unknown events and preserves valid envelopes", () => {
  assert.equal(normalizeVoiceEvent({ type: "STALE_EVENT" }), null);
  const normalized = normalizeVoiceEvent({
    type: VOICE_EVENTS.VOICE_TRANSCRIPT,
    sessionId: "s1",
    turn: 2,
    source: "native",
    timestamp: 456,
    data: { text: "hello" },
    extra: "ignored"
  });
  assert.deepEqual(normalized, {
    type: "VOICE_TRANSCRIPT",
    sessionId: "s1",
    turn: 2,
    source: "native",
    timestamp: 456,
    data: { text: "hello" }
  });
});
