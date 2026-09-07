// =========================================
// H.A.I.V.A. VOICE STATE MACHINE
// Phase 1 foundation: deterministic voice lifecycle.
// =========================================

export const VOICE_STATES = Object.freeze({
  BOOTING: "BOOTING",
  READY: "READY",
  STANDBY: "STANDBY",
  LISTENING: "LISTENING",
  THINKING: "THINKING",
  SPEAKING: "SPEAKING",
  ERROR: "ERROR",
});

const TRANSITIONS = Object.freeze({
  BOOTING: new Set(["READY", "ERROR"]),
  READY: new Set(["STANDBY", "LISTENING", "THINKING", "ERROR"]),
  STANDBY: new Set(["LISTENING", "THINKING", "READY", "ERROR"]),
  LISTENING: new Set(["STANDBY", "THINKING", "READY", "ERROR"]),
  THINKING: new Set(["SPEAKING", "READY", "STANDBY", "ERROR"]),
  SPEAKING: new Set(["STANDBY", "READY", "LISTENING", "ERROR"]),
  ERROR: new Set(["RECOVERING", "READY", "STANDBY"]),
  RECOVERING: new Set(["READY", "STANDBY", "ERROR"]),
});

export class VoiceStateMachine {
  constructor(initialState = VOICE_STATES.BOOTING) {
    if (!Object.values(VOICE_STATES).includes(initialState)) {
      throw new Error(`Invalid initial voice state: ${initialState}`);
    }
    this.state = initialState;
    this.listeners = new Set();
  }

  canTransition(nextState) {
    if (nextState === this.state) return true;
    return TRANSITIONS[this.state]?.has(nextState) === true;
  }

  transition(nextState, metadata = {}) {
    if (!Object.values(VOICE_STATES).includes(nextState) && nextState !== "RECOVERING") {
      throw new Error(`Invalid voice state: ${nextState}`);
    }
    if (!this.canTransition(nextState)) {
      throw new Error(`Invalid voice transition: ${this.state} -> ${nextState}`);
    }

    const previousState = this.state;
    this.state = nextState;
    const event = Object.freeze({ previousState, state: nextState, metadata });
    for (const listener of this.listeners) listener(event);
    return event;
  }

  subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset() {
    this.listeners.clear();
  }
}

export function createVoiceStateMachine(initialState) {
  return new VoiceStateMachine(initialState);
}
