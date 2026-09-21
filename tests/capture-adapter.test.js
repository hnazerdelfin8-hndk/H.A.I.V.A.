import assert from "node:assert/strict";
import { test } from "node:test";
import { CaptureAdapter } from "../core/voice/capture/adapter.js";
import { NativeCaptureAdapter } from "../core/voice/capture/native.js";
import { BrowserCaptureAdapter } from "../core/voice/capture/browser.js";
import { createCaptureAdapter } from "../core/voice/capture/factory.js";

test("capture boundary exposes the canonical lifecycle contract", () => {
  const adapter = new CaptureAdapter();
  for (const method of ["start", "stop", "cancel", "isActive", "destroy"]) {
    assert.equal(typeof adapter[method], "function");
  }
});

test("native adapter owns HaivaBridge capture calls", () => {
  const calls = [];
  const native = new NativeCaptureAdapter({
    getBridge: () => ({
      startVoiceCapture: () => calls.push("start"),
      stopVoiceCapture: () => calls.push("stop")
    })
  });
  assert.equal(native.start(), true);
  assert.equal(native.isActive(), true);
  native.stop();
  assert.deepEqual(calls, ["start", "stop"]);
  assert.equal(native.isActive(), false);
});

test("browser adapter owns Web Speech construction and lifecycle", () => {
  const previous = globalThis.window;
  const calls = [];
  class FakeRecognition {
    start() { calls.push("start"); }
    stop() { calls.push("stop"); }
    abort() { calls.push("abort"); }
  }
  globalThis.window = { SpeechRecognition: FakeRecognition };
  const browser = new BrowserCaptureAdapter();
  browser.initialize();
  assert.ok(browser.recognition instanceof FakeRecognition);
  assert.equal(browser.start(), true);
  browser.stop();
  assert.deepEqual(calls, ["start", "stop"]);
  browser.destroy();
  globalThis.window = previous;
});

test("factory selects native or browser implementation", () => {
  assert.ok(createCaptureAdapter({ native: true }) instanceof NativeCaptureAdapter);
  assert.ok(createCaptureAdapter({ native: false }) instanceof BrowserCaptureAdapter);
});
