// =========================================
// H.A.I.V.A. VOICE LIFECYCLE COORDINATOR
// =========================================
// Flat module: lifecycle/state sequencing only.

const STATES = Object.freeze({ READY: "READY", LISTENING: "LISTENING", THINKING: "THINKING", SPEAKING: "SPEAKING" });
const TRANSITIONS = Object.freeze({
  READY: new Set([STATES.LISTENING]),
  LISTENING: new Set([STATES.THINKING, STATES.READY]),
  THINKING: new Set([STATES.SPEAKING, STATES.READY]),
  SPEAKING: new Set([STATES.LISTENING, STATES.THINKING, STATES.READY])
});

export class VoiceLifecycleV2 {
  constructor({ onStateChange = null } = {}) {
    this.state = STATES.READY;
    this.onStateChange = typeof onStateChange === "function" ? onStateChange : null;
    this.sessionActive = false;
    this.transitionInProgress = false;
  }
  canTransition(nextState) { return Object.values(STATES).includes(nextState) && (this.state === nextState || Boolean(TRANSITIONS[this.state]?.has(nextState))); }
  transition(nextState) {
    if (!this.canTransition(nextState) || this.transitionInProgress) return false;
    if (this.state === nextState) return true;
    this.transitionInProgress = true;
    const previousState = this.state;
    this.state = nextState;
    if (nextState === STATES.READY) this.sessionActive = false;
    else if (!this.sessionActive) this.sessionActive = true;
    try { this.onStateChange?.(nextState, previousState); } finally { this.transitionInProgress = false; }
    return true;
  }
  startSession() { this.sessionActive = true; return true; }
  endSession() { this.sessionActive = false; return this.finishReady(); }
  isConversationActive() { return this.sessionActive; }
  activateListening() { this.startSession(); return this.transition(STATES.LISTENING); }
  beginThinking() { return this.transition(STATES.THINKING); }
  beginSpeaking() { return this.transition(STATES.SPEAKING); }
  returnToListening() { return this.sessionActive ? this.transition(STATES.LISTENING) : this.transition(STATES.READY); }
  finishReady() { return this.transition(STATES.READY); }
  interruptToThinking() { return this.state === STATES.SPEAKING ? this.transition(STATES.THINKING) : false; }
}
export { STATES as VOICE_LIFECYCLE_STATES };
