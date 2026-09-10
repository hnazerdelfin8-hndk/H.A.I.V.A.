// =========================================
// H.A.I.V.A. V2 VOICE LIFECYCLE COORDINATOR
// =========================================
// V2 owns lifecycle/state sequencing only.
// V1 owns voice capture. V3 owns interruption control.
// Boot Loader remains outside this lifecycle boundary.

const STATES = Object.freeze({
  READY: "READY",
  LISTENING: "LISTENING",
  THINKING: "THINKING",
  SPEAKING: "SPEAKING"
});

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
  }

  canTransition(nextState) {
    if (!TRANSITIONS[nextState] && nextState !== STATES.READY) return false;
    return this.state === nextState || Boolean(TRANSITIONS[this.state]?.has(nextState));
  }

  transition(nextState) {
    if (!this.canTransition(nextState)) return false;
    if (this.state === nextState) return true;
    const previousState = this.state;
    this.state = nextState;
    this.onStateChange?.(nextState, previousState);
    return true;
  }

  activateListening() {
    return this.transition(STATES.LISTENING);
  }

  beginThinking() {
    return this.transition(STATES.THINKING);
  }

  beginSpeaking() {
    return this.transition(STATES.SPEAKING);
  }

  returnToListening() {
    return this.transition(STATES.LISTENING);
  }

  finishReady() {
    return this.transition(STATES.READY);
  }

  interruptToThinking() {
    if (this.state !== STATES.SPEAKING) return false;
    return this.transition(STATES.THINKING);
  }
}

export { STATES as VOICE_LIFECYCLE_STATES };
