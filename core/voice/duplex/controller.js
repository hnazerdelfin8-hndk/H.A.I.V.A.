import { DUPLEX_EVENTS, DUPLEX_STATES } from "./events.js";

function getBridge() {
  return typeof window !== "undefined" ? window.HaivaBridge || null : null;
}

/**
 * Canonical JS boundary for native duplex audio.
 *
 * Ownership rule: this class is the only Voice-domain object allowed to ask
 * the native bridge for audio lifecycle changes. V1/V2/V3/V4 are consumers
 * of events and must not call native microphone APIs themselves.
 */
export class DuplexController {
  constructor({ onEvent = null } = {}) {
    this.state = DUPLEX_STATES.IDLE;
    this.turn = null;
    this.onEvent = typeof onEvent === "function" ? onEvent : null;
    this.bound = false;
    this.bind();
  }

  emit(type, detail = {}) {
    const payload = { ...detail, type, turn: detail.turn ?? this.turn, source: detail.source || "duplex" };
    this.onEvent?.(payload);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(type, { detail: payload }));
    }
    return payload;
  }

  bind() {
    if (this.bound || typeof window === "undefined") return;
    this.bound = true;
    for (const type of Object.values(DUPLEX_EVENTS)) {
      window.addEventListener(type, event => {
        const detail = event?.detail || {};
        if (this.turn != null && detail.turn != null && Number(detail.turn) !== Number(this.turn)) return;
        if (type === DUPLEX_EVENTS.READY) this.state = DUPLEX_STATES.CAPTURING;
        if (type === DUPLEX_EVENTS.BARGE_IN) this.state = DUPLEX_STATES.BARGE_IN;
        if (type === DUPLEX_EVENTS.ERROR) this.state = DUPLEX_STATES.ERROR;
        this.onEvent?.({ ...detail, type });
      });
    }
  }

  start(turn) {
    const bridge = getBridge();
    if (!bridge || typeof bridge.startDuplexAudio !== "function") return false;
    this.turn = Number(turn);
    try {
      const accepted = bridge.startDuplexAudio(this.turn);
      if (accepted !== false) this.state = DUPLEX_STATES.CAPTURING;
      return accepted !== false;
    } catch (error) {
      this.state = DUPLEX_STATES.ERROR;
      this.emit(DUPLEX_EVENTS.ERROR, { message: error?.message || String(error) });
      return false;
    }
  }

  setPlaying(turn = this.turn) {
    if (turn != null) this.turn = Number(turn);
    this.state = DUPLEX_STATES.PLAYING;
  }

  stopPlayback(turn = this.turn) {
    const bridge = getBridge();
    try { bridge?.stopSpeaking?.(); } catch (_) {}
    if (turn != null) this.turn = Number(turn);
  }

  stop(turn = this.turn) {
    const bridge = getBridge();
    try { bridge?.stopDuplexAudio?.(); } catch (_) {}
    this.state = DUPLEX_STATES.IDLE;
    this.turn = null;
    this.emit(DUPLEX_EVENTS.RELEASED, { turn: null });
  }

  release() { this.stop(); }
}
