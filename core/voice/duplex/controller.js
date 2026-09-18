import { DUPLEX_EVENTS, DUPLEX_STATES } from "./events.js";

function getBridge() {
  return typeof window !== "undefined" ? window.HaivaBridge || null : null;
}

/**
 * Canonical JS duplex boundary.
 *
 * ONE native audio authority:
 *   DuplexController -> native DuplexAudioController -> AudioRecord
 *
 * V1/V2/V3/V4 are consumers of events, not microphone owners.
 */
export class DuplexController {
  constructor({ onInterruptDetected = null, onReady = null, onError = null, onEvent = null } = {}) {
    this.state = DUPLEX_STATES.IDLE;
    this.turn = null;
    this.active = false;
    this.ready = false;
    this.bound = false;
    this.onInterruptDetected = typeof onInterruptDetected === "function" ? onInterruptDetected : null;
    this.onReady = typeof onReady === "function" ? onReady : null;
    this.onError = typeof onError === "function" ? onError : null;
    this.onEvent = typeof onEvent === "function" ? onEvent : null;
    this.bind();
  }

  bind() {
    if (this.bound || typeof window === "undefined") return;
    this.bound = true;

    window.addEventListener(DUPLEX_EVENTS.READY, event => {
      if (!this.active || !this.acceptTurn(event)) return;
      this.ready = true;
      this.state = DUPLEX_STATES.CAPTURING;
      this.onReady?.(event.detail || {});
      this.onEvent?.(event.detail || {});
    });

    window.addEventListener(DUPLEX_EVENTS.BARGE_IN, event => {
      if (!this.active || !this.acceptTurn(event)) return;
      this.state = DUPLEX_STATES.BARGE_IN;
      const detail = event.detail || {};
      this.onInterruptDetected?.({ ...detail, source: detail.source || "native-duplex" });
      this.onEvent?.(detail);
    });

    window.addEventListener(DUPLEX_EVENTS.ERROR, event => {
      if (!this.active || !this.acceptTurn(event)) return;
      this.active = false;
      this.ready = false;
      this.state = DUPLEX_STATES.ERROR;
      this.onError?.(event.detail || {});
      this.onEvent?.(event.detail || {});
    });
  }

  acceptTurn(event) {
    const eventTurn = event?.detail?.turn;
    return eventTurn == null || this.turn == null || Number(eventTurn) === Number(this.turn);
  }

  start(turn) {
    const bridge = getBridge();
    if (!bridge || typeof bridge.startDuplexAudio !== "function") return false;
    this.turn = Number(turn);
    this.active = true;
    this.ready = false;
    this.state = DUPLEX_STATES.CAPTURING;
    try {
      return bridge.startDuplexAudio(this.turn) !== false;
    } catch (error) {
      this.active = false;
      this.state = DUPLEX_STATES.ERROR;
      this.onError?.({ source: "duplex-controller", message: error?.message || String(error) });
      return false;
    }
  }

  // Temporary compatibility path. It is intentionally routed through the
  // same controller so the legacy monitor cannot become a second authority.
  startInterruptMonitor(turn) {
    const bridge = getBridge();
    if (!bridge) return false;
    if (typeof bridge.startDuplexAudio === "function") return this.start(turn);
    if (typeof bridge.startDuplexInterruptMonitor !== "function") return false;
    this.turn = Number(turn);
    this.active = true;
    this.ready = false;
    this.state = DUPLEX_STATES.CAPTURING;
    try {
      bridge.startDuplexInterruptMonitor(this.turn);
      return true;
    } catch (error) {
      this.active = false;
      this.state = DUPLEX_STATES.ERROR;
      this.onError?.({ source: "duplex-controller", message: error?.message || String(error) });
      return false;
    }
  }

  setPlaying(turn = this.turn) {
    if (turn != null) this.turn = Number(turn);
    this.state = DUPLEX_STATES.PLAYING;
  }

  stopPlayback(turn = this.turn) {
    try { getBridge()?.stopSpeaking?.(); } catch (_) {}
    if (turn != null) this.turn = Number(turn);
  }

  stop(turn = this.turn) {
    const bridge = getBridge();
    try {
      if (typeof bridge?.stopDuplexAudio === "function") bridge.stopDuplexAudio();
      else bridge?.stopDuplexInterruptMonitor?.();
    } catch (_) {}
    this.active = false;
    this.ready = false;
    this.state = DUPLEX_STATES.IDLE;
    this.turn = null;
  }

  stopInterruptMonitor() {
    if (!this.active) return false;
    this.stop();
    return true;
  }

  isActive() { return this.active; }
  isReady() { return this.active && this.ready; }
  getTurn() { return this.turn; }
  release() { this.stop(); }
}
