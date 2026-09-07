import test from "node:test";
import assert from "node:assert/strict";
import { VoiceStateMachine, VOICE_STATES } from "../core/voice/state-machine.js";

test("voice state machine follows the normal lifecycle", () => {
  const machine = new VoiceStateMachine();
  machine.transition(VOICE_STATES.READY);
  machine.transition(VOICE_STATES.STANDBY);
  machine.transition(VOICE_STATES.LISTENING);
  machine.transition(VOICE_STATES.THINKING);
  machine.transition(VOICE_STATES.SPEAKING);
  machine.transition(VOICE_STATES.STANDBY);
  assert.equal(machine.state, VOICE_STATES.STANDBY);
});

test("voice state machine rejects unsafe jumps", () => {
  const machine = new VoiceStateMachine();
  machine.transition(VOICE_STATES.READY);
  assert.throws(() => machine.transition(VOICE_STATES.SPEAKING), /Invalid voice transition/);
});

test("voice state machine supports error recovery", () => {
  const machine = new VoiceStateMachine();
  machine.transition(VOICE_STATES.READY);
  machine.transition(VOICE_STATES.LISTENING);
  machine.transition(VOICE_STATES.ERROR);
  machine.transition("RECOVERING");
  machine.transition(VOICE_STATES.READY);
  assert.equal(machine.state, VOICE_STATES.READY);
});
