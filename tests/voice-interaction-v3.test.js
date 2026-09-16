import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_INTERRUPT_KEYWORDS,
  V3_STATES,
  createVoiceInteractionV3,
  detectVoiceInterrupt,
  parseStopAndInstruction
} from "../core/voice/v3/interaction-v3.js";

test("V3 interrupt vocabulary recognizes natural English and Tagalog stop phrases", () => {
  for (const phrase of ["stop", "hinto", "hinto muna", "teka lang", "sandali", "wait lang", "huwag na", "never mind"]) {
    const result = detectVoiceInterrupt(phrase);
    assert.equal(result.interrupted, true, phrase);
  }
});

test("V3 interrupt matching recognizes a single-word interrupt after normal speech", () => {
  for (const phrase of ["please stop", "okay teka", "wait please", "can you pause"]) {
    const result = detectVoiceInterrupt(phrase);
    assert.equal(result.interrupted, true, phrase);
  }
});

test("V3 interrupt matching does not trigger on an unrelated sentence", () => {
  const result = detectVoiceInterrupt("the wait time is three seconds");
  assert.equal(result.interrupted, false);
});

test("V3 parser treats STOP alone as interruption with no new instruction", () => {
  for (const phrase of ["Stop", "Hinto.", "Teka lang!"]) {
    const result = parseStopAndInstruction(phrase);
    assert.equal(result.interrupted, true, phrase);
    assert.equal(result.instruction, "", phrase);
  }
});

test("V3 parser extracts a new instruction after STOP", () => {
  const result = parseStopAndInstruction("Stop, gumawa ka ng summary.");
  assert.deepEqual(result, { interrupted: true, phrase: "stop", instruction: "gumawa ka ng summary" });
});

test("V3 parser extracts a new instruction after HINTO", () => {
  const result = parseStopAndInstruction("Hinto, buksan mo ang calendar");
  assert.deepEqual(result, { interrupted: true, phrase: "hinto", instruction: "buksan mo ang calendar" });
});

test("V3 coordinator commits one authoritative result per turn", () => {
  const coordinator = createVoiceInteractionV3();
  const turn = coordinator.beginTurn();
  assert.deepEqual(coordinator.commitResult(turn, "Hello Haiva"), { turn, text: "hello haiva" });
  assert.equal(coordinator.commitResult(turn, "duplicate"), null);
});

test("V3 coordinator rejects stale turn results", () => {
  const coordinator = createVoiceInteractionV3();
  const oldTurn = coordinator.beginTurn();
  coordinator.beginTurn();
  assert.equal(coordinator.commitResult(oldTurn, "stale"), null);
});

test("V3 interrupt detects and invalidates the speaking turn without routing to V1", () => {
  const coordinator = createVoiceInteractionV3({ interruptKeywords: DEFAULT_INTERRUPT_KEYWORDS });
  const speakingTurn = coordinator.beginTurn();
  coordinator.beginMonitoring(speakingTurn);
  assert.equal(coordinator.getState(), V3_STATES.MONITORING);
  const interruption = coordinator.interrupt("Teka lang", speakingTurn);
  assert.equal(interruption.interrupted, true);
  assert.equal(interruption.route, "none");
  assert.notEqual(interruption.turn, speakingTurn);
  assert.equal(coordinator.isCurrent(interruption.turn), true);
});

test("V3 interrupt invalidates the old turn for STOP plus instruction", () => {
  const coordinator = createVoiceInteractionV3();
  const speakingTurn = coordinator.beginTurn();
  coordinator.beginMonitoring(speakingTurn);
  const interruption = coordinator.interrupt("Stop, gumawa ka ng summary", speakingTurn);
  assert.equal(interruption.interrupted, true);
  assert.equal(interruption.instruction, "gumawa ka ng summary");
  assert.equal(interruption.route, "none");
  assert.equal(coordinator.commitResult(speakingTurn, "old response"), null);
  assert.equal(coordinator.isCurrent(interruption.turn), true);
});

test("V3 compatibility handoff state does not claim V1 routing", () => {
  const coordinator = createVoiceInteractionV3();
  const speakingTurn = coordinator.beginTurn();
  assert.equal(coordinator.beginMonitoring(speakingTurn), true);
  const handoff = coordinator.prepareHandoffToV1(speakingTurn);
  assert.deepEqual(handoff, {
    route: "none",
    interrupted: false,
    instruction: "",
    turn: speakingTurn
  });
  assert.equal(coordinator.getState(), V3_STATES.HANDOFF);
  assert.equal(coordinator.completeHandoff(speakingTurn), true);
  assert.equal(coordinator.getState(), V3_STATES.IDLE);
});

test("V3 rejects stale normal handoff", () => {
  const coordinator = createVoiceInteractionV3();
  const oldTurn = coordinator.beginTurn();
  coordinator.beginTurn();
  assert.equal(coordinator.prepareHandoffToV1(oldTurn), null);
});
