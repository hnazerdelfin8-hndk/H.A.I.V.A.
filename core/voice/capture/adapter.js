// =========================================
// H.A.I.V.A. VOICE — CAPTURE ADAPTER CONTRACT
// =========================================

export const CAPTURE_EVENTS = Object.freeze({
  READY: "ready",
  BEGIN: "begin",
  SEGMENT_END: "segment-end",
  PARTIAL: "partial",
  RESULT: "result",
  COMPLETE: "complete",
  TIMEOUT: "timeout",
  ERROR: "error"
});

export class CaptureAdapter {
  constructor({ onEvent = null } = {}) {
    this.onEvent = typeof onEvent === "function" ? onEvent : null;
    this.active = false;
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
    return this;
  }

  start() { throw new Error("CaptureAdapter.start() must be implemented"); }
  stop() { this.active = false; }
  cancel() { this.stop(); }
  isActive() { return this.active; }

  emit(type, data = {}) {
    this.onEvent?.({ type, ...data });
  }

  destroy() {
    this.stop();
    this.onEvent = null;
    this.initialized = false;
  }
}
