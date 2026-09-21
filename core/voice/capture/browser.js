import { CaptureAdapter, CAPTURE_EVENTS } from "./adapter.js";
import { createSpeechRecognition } from "../speech-to-text.js";

export class BrowserCaptureAdapter extends CaptureAdapter {
  constructor({ onEvent = null, recognitionConfig = {} } = {}) {
    super({ onEvent });
    this.recognitionConfig = recognitionConfig;
    this.recognition = null;
  }

  initialize() {
    if (this.initialized) return this;
    super.initialize();
    this.recognition = createSpeechRecognition({
      continuous: false,
      interimResults: true,
      ...this.recognitionConfig
    });
    if (!this.recognition) return this;

    this.recognition.onresult = event => {
      const text = event.results?.[event.results.length - 1]?.[0]?.transcript || "";
      if (text) this.emit(CAPTURE_EVENTS.RESULT, { text });
    };
    this.recognition.onerror = event => {
      this.active = false;
      this.emit(CAPTURE_EVENTS.ERROR, { error: event?.error || "browser-recognition-error" });
    };
    this.recognition.onend = () => {
      if (this.active) this.emit(CAPTURE_EVENTS.COMPLETE, { reason: "ended" });
      this.active = false;
    };
    return this;
  }

  start() {
    if (!this.recognition) return false;
    this.active = true;
    try {
      this.recognition.start();
      return true;
    } catch (_) {
      this.active = false;
      return false;
    }
  }

  stop() {
    this.active = false;
    try { this.recognition?.stop?.(); } catch (_) {}
  }

  cancel() {
    this.active = false;
    try { this.recognition?.abort?.(); } catch (_) {}
  }

  destroy() {
    this.cancel();
    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
    }
    this.recognition = null;
    super.destroy();
  }
}
