// =========================================
// H.A.I.V.A. DUPLEX AUDIO CONTROLLER
// =========================================
// Coordinates the native duplex microphone monitor used while TTS is active.
// This is an internal VoiceInteraction component, not a new lifecycle owner.
// V3 remains the interruption state owner; V4 remains the routing boundary.
//
// Native contract:
//   startDuplexInterruptMonitor()
//   stopDuplexInterruptMonitor()
//   haiva:duplex-interrupt-detected
//   haiva:duplex-monitor-ready
//   haiva:duplex-monitor-error
//
// The native monitor should use AudioRecord + platform echo/noise processing
// where available. It only reports speech onset; V3 starts STT after the
// interrupt is detected so TTS can be stopped before full recognition.

export const DUPLEX_AUDIO_EVENTS = Object.freeze({
  INTERRUPT_DETECTED: "haiva:duplex-interrupt-detected",
  MONITOR_READY: "haiva:duplex-monitor-ready",
  MONITOR_ERROR: "haiva:duplex-monitor-error"
});

function bridge() {
  if (typeof window === "undefined") return null;
  return window.HaivaBridge || null;
}

export class DuplexAudioController {
  constructor({ onInterruptDetected = null, onReady = null, onError = null } = {}) {
    this.onInterruptDetected = typeof onInterruptDetected === "function" ? onInterruptDetected : null;
    this.onReady = typeof onReady === "function" ? onReady : null;
    this.onError = typeof onError === "function" ? onError : null;
    this.active = false;
    this.ready = false;
    this.turn = null;
    this.bound = false;
    this.bindEvents();
  }

  static isSupported() {
    return Boolean(
      typeof window !== "undefined" &&
      window.HaivaBridge &&
      typeof window.HaivaBridge.startDuplexInterruptMonitor === "function" &&
      typeof window.HaivaBridge.stopDuplexInterruptMonitor === "function"
    );
  }

  bindEvents() {
    if (this.bound || typeof window === "undefined") return;
    this.bound = true;

    window.addEventListener(DUPLEX_AUDIO_EVENTS.INTERRUPT_DETECTED, event => {
      if (!this.active || !this.ready) return;
      const detail = event?.detail || {};
      if (detail.turn != null && this.turn != null && Number(detail.turn) !== Number(this.turn)) return;
      this.onInterruptDetected?.({
        ...detail,
        source: detail.source || "native-duplex"
      });
    });

    window.addEventListener(DUPLEX_AUDIO_EVENTS.MONITOR_READY, event => {
      if (!this.active) return;
      const detail = event?.detail || {};
      if (detail.turn != null && this.turn != null && Number(detail.turn) !== Number(this.turn)) return;
      this.ready = true;
      this.onReady?.(detail);
    });

    window.addEventListener(DUPLEX_AUDIO_EVENTS.MONITOR_ERROR, event => {
      if (!this.active) return;
      const detail = event?.detail || {};
      if (detail.turn != null && this.turn != null && Number(detail.turn) !== Number(this.turn)) return;
      this.active = false;
      this.ready = false;
      this.turn = null;
      this.onError?.(detail);
    });
  }

  startInterruptMonitor(turn) {
    if (!DuplexAudioController.isSupported()) return false;
    if (this.active) return this.turn === turn;
    try {
      this.active = true;
      this.ready = false;
      this.turn = turn;
      window.HaivaBridge.startDuplexInterruptMonitor(Number(turn));
      // Native startup is asynchronous. `true` means the start request was
      // accepted; `ready` becomes true only after MONITOR_READY arrives.
      return true;
    } catch (error) {
      this.active = false;
      this.ready = false;
      this.turn = null;
      this.onError?.({ source: "duplex-controller", message: error?.message || String(error) });
      return false;
    }
  }

  stopInterruptMonitor() {
    if (!this.active) return false;
    this.active = false;
    this.ready = false;
    this.turn = null;
    try { bridge()?.stopDuplexInterruptMonitor?.(); } catch (_) {}
    return true;
  }

  isActive() {
    return this.active;
  }

  isReady() {
    return this.active && this.ready;
  }

  getTurn() {
    return this.turn;
  }

  release() {
    this.stopInterruptMonitor();
    this.onInterruptDetected = null;
    this.onReady = null;
    this.onError = null;
  }
}
