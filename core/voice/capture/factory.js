import { BrowserCaptureAdapter } from "./browser.js";
import { NativeCaptureAdapter } from "./native.js";

export function createCaptureAdapter({ native = false, onEvent = null, recognitionConfig = {} } = {}) {
  return native
    ? new NativeCaptureAdapter({ onEvent })
    : new BrowserCaptureAdapter({ onEvent, recognitionConfig });
}
