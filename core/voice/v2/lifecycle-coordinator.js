// =========================================
// H.A.I.V.A. V2 VOICE LIFECYCLE COORDINATOR
// =========================================
// V2 owns lifecycle/state sequencing only.
// V1 owns capture. V3 owns interruption capture/events.
// V2 reports state only to its owning Voice Interaction coordinator.
// It never interprets user speech or decides conversation meaning.

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
    this.sessionActive = false;
    this.transitionInProgress = false;
  }

  canTransition(nextState) {
    if (!Object.values(STATES).includes(nextState)) return false;
    return this.state === nextState || Boolean(TRANSITIONS[this.state]?.has(nextState));
  }

  transition(nextState) {
    if (!this.canTransition(nextState)) return false;
    if (this.state === nextState) return true;
    if (this.transitionInProgress) return false;

    this.transitionInProgress = true;
    const previousState = this.state;
    this.state = nextState;

    if (nextState === STATES.READY) this.sessionActive = false;
    else if (!this.sessionActive) this.sessionActive = true;

    try {
      this.onStateChange?.(nextState, previousState);
    } finally {
      this.transitionInProgress = false;
    }
    return true;
  }

  startSession() {
    this.sessionActive = true;
    return true;
  }

  endSession() {
    this.sessionActive = false;
    return this.finishReady();
  }

  isConversationActive() {
    return this.sessionActive;
  }

  activateListening() {
    this.startSession();
    return this.transition(STATES.LISTENING);
  }

  beginThinking() {
    return this.transition(STATES.THINKING);
  }

  beginSpeaking() {
    return this.transition(STATES.SPEAKING);
  }

  returnToListening() {
    if (!this.sessionActive) return this.transition(STATES.READY);
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
