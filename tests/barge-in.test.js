import assert from "node:assert/strict";
import { test } from "node:test";
import { BARGE_IN_STATES, createBargeInCoordinator } from "../core/voice/barge-in.js";

test("Barge-in coordinator arms the active speaking turn without owning a microphone", () => {
  const coordinator = createBargeInCoordinator();
  const turn = coordinator.beginTurn();
  assert.equal(coordinator.beginMonitoring(turn), true);
  assert.equal(coordinator.getState(), BARGE_IN_STATES.ARMED);
  assert.equal(coordinator.isMonitoring(turn), true);
});

test("Barge-in commits one raw interrupt candidate per speaking turn", () => {
  const coordinator = createBargeInCoordinator();
  const turn = coordinator.beginTurn();
  coordinator.beginMonitoring(turn);
  assert.equal(coordinator.beginCapture(turn), true);
  assert.deepEqual(coordinator.commitCapture(turn, "Stop, gumawa ka ng summary"), {
    turn,
    text: "Stop, gumawa ka ng summary",
    source: "barge-in"
  });
  assert.equal(coordinator.commitCapture(turn, "duplicate"), null);
});

test("Barge-in releases a non-interruption candidate without changing the turn", () => {
  const coordinator = createBargeInCoordinator();
  const turn = coordinator.beginTurn();
  coordinator.beginMonitoring(turn);
  assert.equal(coordinator.beginCapture(turn), true);
  assert.ok(coordinator.commitCapture(turn, "the wait time is three seconds"));
  assert.equal(coordinator.releaseCapture(turn), true);
  assert.deepEqual(coordinator.commitCapture(turn, "another capture"), {
    turn,
    text: "another capture",
    source: "barge-in"
  });
});

test("Barge-in rejects stale capture results", () => {
  const coordinator = createBargeInCoordinator();
  const oldTurn = coordinator.beginTurn();
  coordinator.beginTurn();
  assert.equal(coordinator.commitCapture(oldTurn, "stale"), null);
});

test("Barge-in has no semantic interruption parser or V1 routing API", () => {
  const coordinator = createBargeInCoordinator();
  assert.equal("interrupt" in coordinator, false);
  assert.equal("detectVoiceInterrupt" in coordinator, false);
  assert.equal("parseStopAndInstruction" in coordinator, false);
  assert.equal("routeToV1" in coordinator, false);
});

test("Barge-in monitoring stops cleanly", () => {
  const coordinator = createBargeInCoordinator();
  const turn = coordinator.beginTurn();
  assert.equal(coordinator.beginMonitoring(turn), true);
  assert.equal(coordinator.stopMonitoring(turn), true);
  assert.equal(coordinator.getState(), BARGE_IN_STATES.IDLE);
  assert.equal(coordinator.isMonitoring(turn), false);
});

test("Barge-in requires an explicit capture handoff before committing ASR text", () => {
  const coordinator = createBargeInCoordinator();
  const turn = coordinator.beginTurn();
  coordinator.beginMonitoring(turn);
  assert.equal(coordinator.commitCapture(turn, "premature"), null);
  assert.equal(coordinator.beginCapture(turn), true);
  assert.ok(coordinator.commitCapture(turn, "captured after handoff"));
});
