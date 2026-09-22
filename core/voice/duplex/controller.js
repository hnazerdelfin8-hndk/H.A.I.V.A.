import { DUPLEX_EVENTS, DUPLEX_STATES } from "./events.js";

function getBridge() {
  return typeof window !== "undefined" ? window.HaivaBridge || null : null;
}

/**
 * Canonical JS duplex boundary.
 *
 * ONE native audio authority:
 *   DuplexController -> native DuplexAudioMonitor -> AudioRecord
 *
 * The controller is the only JS owner of duplex start/stop and duplex events.
 * V1/V2/V3/V4 are consumers of events, not microphone owners.
 */
export class DuplexController {
  constructor({ onInterruptDetected = null, onReady = null, onError = null, onEvent = null } = {}) {
    this.state = DUPLEX_STATES.IDLE;
    this.turn = null;
    this.active = false;
    this.ready = false;
    this.bound = false;
    this.disposed = false;
    this.handlers = null;
    this.onInterruptDetected = typeof onInterruptDetected === "function" ? onInterruptDetected : null;
    this.onReady = typeof onReady === "function" ? onReady : null;
    this.onError = typeof onError === "function" ? onError : null;
    this.onEvent = typeof onEvent === "function" ? onEvent : null;
    this.bind();
  }

  bind() {
    if (this.bound || this.disposed || typeof window === "undefined") return;

    const readyHandler = event => {
      if (!this.active || !this.acceptTurn(event)) return;
      this.ready = true;
      this.state = DUPLEX_STATES.CAPTURING;
      const detail = event.detail || {};
      this.onReady?.(detail);
      this.onEvent?.(detail);
    };

    const bargeInHandler = event => {
      if (!this.active || !this.acceptTurn(event)) return;
      this.state = DUPLEX_STATES.BARGE_IN;
      const detail = event.detail || {};
      this.onInterruptDetected?.({ ...detail, source: detail.source || "native-duplex" });
      this.onEvent?.(detail);
    };

    const errorHandler = event => {
      if (!this.active || !this.acceptTurn(event)) return;
      this.active = false;
      this.ready = false;
      this.state = DUPLEX_STATES.ERROR;
      const detail = event.detail || {};
      this.onError?.(detail);
      this.onEvent?.(detail);
    };

    window.addEventListener(DUPLEX_EVENTS.READY, readyHandler);
    window.addEventListener(DUPLEX_EVENTS.BARGE_IN, bargeInHandler);
    window.addEventListener(DUPLEX_EVENTS.ERROR, errorHandler);

    this.handlers = {
      [DUPLEX_EVENTS.READY]: readyHandler,
      [DUPLEX_EVENTS.BARGE_IN]: bargeInHandler,
      [DUPLEX_EVENTS.ERROR]: errorHandler
    };
    this.bound = true;
  }

  unbind() {
    if (!this.bound || typeof window === "undefined") return;
    for (const [eventName, handler] of Object.entries(this.handlers || {})) {
      window.removeEventListener(eventName, handler);
    }
    this.handlers = null;
    this.bound = false;
  }

  acceptTurn(event) {
    const eventTurn = event?.detail?.turn;
    return eventTurn == null || this.turn == null || Number(eventTurn) === Number(this.turn);
  }

  start(turn) {
    const bridge = getBridge();
    const nextTurn = Number(turn);
    if (this.disposed || !Number.isFinite(nextTurn)) return false;
    if (!bridge || typeof bridge.startDuplexAudio !== "function") return false;

    if (this.active && this.turn === nextTurn) return true;
    if (this.active) this.stop(this.turn);

    this.turn = nextTurn;
    this.active = true;
    this.ready = false;
    this.state = DUPLEX_STATES.CAPTURING;

    try {
      const result = bridge.startDuplexAudio(this.turn);
      if (result === false) {
        this.active = false;
        this.ready = false;
        this.state = DUPLEX_STATES.ERROR;
        this.onError?.({ source: "duplex-controller", message: "DUPLEX_START_REJECTED" });
        return false;
      }
      return true;
    } catch (error) {
      this.active = false;
      this.ready = false;
      this.state = DUPLEX_STATES.ERROR;
      this.onError?.({ source: "duplex-controller", message: error?.message || String(error) });
      return false;
    }
  }

  setPlaying(turn = this.turn) {
    if (turn != null) this.turn = Number(turn);
    if (!this.active) return false;
    this.state = DUPLEX_STATES.PLAYING;
    return true;
  }

  stopPlayback(turn = this.turn) {
    if (turn != null && this.turn != null && Number(turn) !== Number(this.turn)) return false;
    try { getBridge()?.stopSpeaking?.(); } catch (_) {}
    return true;
  }

  stop(turn = this.turn) {
    if (turn != null && this.turn != null && Number(turn) !== Number(this.turn)) return false;
    if (this.disposed) return false;

    try { getBridge()?.stopDuplexAudio?.(); } catch (_) {}
    this.active = false;
    this.ready = false;
    this.state = DUPLEX_STATES.IDLE;
    this.turn = null;
    return true;
  }

  isActive() { return this.active; }
  isReady() { return this.active && this.ready; }
  getTurn() { return this.turn; }

  release() {
    return this.stop();
  }

  destroy() {
    if (this.disposed) return;
    this.stop();
    this.unbind();
    this.disposed = true;
    this.onInterruptDetected = null;
    this.onReady = null;
    this.onError = null;
    this.onEvent = null;
  }
}
