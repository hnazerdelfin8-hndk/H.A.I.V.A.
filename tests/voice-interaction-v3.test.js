import assert from "node:assert/strict";
import { test } from "node:test";
import { V3_STATES, createVoiceInteractionV3 } from "../core/voice/v3/interaction-v3.js";

test("V3 coordinator monitors the active speaking turn", () => {
  const coordinator = createVoiceInteractionV3();
  const turn = coordinator.beginTurn();
  assert.equal(coordinator.beginMonitoring(turn), true);
  assert.equal(coordinator.getState(), V3_STATES.MONITORING);
  assert.equal(coordinator.isMonitoring(turn), true);
});

test("V3 commits one raw capture per speaking turn", () => {
  const coordinator = createVoiceInteractionV3();
  const turn = coordinator.beginTurn();
  coordinator.beginMonitoring(turn);
  assert.deepEqual(coordinator.commitCapture(turn, "Stop, gumawa ka ng summary"), {
    turn,
    text: "Stop, gumawa ka ng summary",
    source: "v3"
  });
  assert.equal(coordinator.commitCapture(turn, "duplicate"), null);
});

test("V3 releases a non-interruption capture without changing the turn", () => {
  const coordinator = createVoiceInteractionV3();
  const turn = coordinator.beginTurn();
  coordinator.beginMonitoring(turn);
  assert.ok(coordinator.commitCapture(turn, "the wait time is three seconds"));
  assert.equal(coordinator.releaseCapture(turn), true);
  assert.deepEqual(coordinator.commitCapture(turn, "another capture"), {
    turn,
    text: "another capture",
    source: "v3"
  });
});

test("V3 rejects stale capture results", () => {
  const coordinator = createVoiceInteractionV3();
  const oldTurn = coordinator.beginTurn();
  coordinator.beginTurn();
  assert.equal(coordinator.commitCapture(oldTurn, "stale"), null);
});

test("V3 has no semantic interruption parser or V1 routing API", () => {
  const coordinator = createVoiceInteractionV3();
  assert.equal("interrupt" in coordinator, false);
  assert.equal("detectVoiceInterrupt" in coordinator, false);
  assert.equal("parseStopAndInstruction" in coordinator, false);
  assert.equal("routeToV1" in coordinator, false);
});

test("V3 monitoring stops cleanly", () => {
  const coordinator = createVoiceInteractionV3();
  const turn = coordinator.beginTurn();
  assert.equal(coordinator.beginMonitoring(turn), true);
  assert.equal(coordinator.stopMonitoring(turn), true);
  assert.equal(coordinator.getState(), V3_STATES.IDLE);
  assert.equal(coordinator.isMonitoring(turn), false);
});
