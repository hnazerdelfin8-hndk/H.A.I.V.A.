import { CaptureAdapter, CAPTURE_EVENTS } from "./adapter.js";

export class NativeCaptureAdapter extends CaptureAdapter {
  constructor({ onEvent = null, getBridge = null } = {}) {
    super({ onEvent });
    this.getBridge = typeof getBridge === "function"
      ? getBridge
      : () => (typeof window !== "undefined" ? window.HaivaBridge || null : null);
    this.listeners = [];
  }

  initialize() {
    if (this.initialized) return this;
    super.initialize();
    if (typeof window === "undefined") return this;

    for (const type of Object.values(CAPTURE_EVENTS)) {
      const name = `haiva:native-voice-${type}`;
      const handler = event => this.emit(type, { detail: event.detail || {} });
      window.addEventListener(name, handler);
      this.listeners.push([name, handler]);
    }
    return this;
  }

  start() {
    const bridge = this.getBridge();
    if (!bridge || typeof bridge.startVoiceCapture !== "function") return false;
    this.active = true;
    try {
      bridge.startVoiceCapture();
      return true;
    } catch (_) {
      this.active = false;
      return false;
    }
  }

  stop() {
    const bridge = this.getBridge();
    try { bridge?.stopVoiceCapture?.(); } catch (_) {}
    this.active = false;
  }

  cancel() { this.stop(); }

  destroy() {
    if (typeof window !== "undefined") {
      for (const [name, handler] of this.listeners) window.removeEventListener(name, handler);
    }
    this.listeners = [];
    this.stop();
    super.destroy();
  }
}
