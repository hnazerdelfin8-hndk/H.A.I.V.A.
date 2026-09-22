import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { readFileSync } from "node:fs";
import { DuplexController } from "../core/voice/duplex/controller.js";
import { DUPLEX_EVENTS, DUPLEX_STATES } from "../core/voice/duplex/events.js";

const originalWindow = globalThis.window;

function makeWindow() {
  const listeners = new Map();
  const calls = [];
  const win = {
    HaivaBridge: {
      startDuplexAudio: turn => { calls.push(["start", turn]); },
      stopDuplexAudio: () => { calls.push(["stop"]); },
      stopSpeaking: () => { calls.push(["tts-stop"]); }
    },
    addEventListener: (name, handler) => {
      const set = listeners.get(name) || new Set();
      set.add(handler);
      listeners.set(name, set);
    },
    removeEventListener: (name, handler) => listeners.get(name)?.delete(handler),
    emit: (name, detail = {}) => {
      for (const handler of listeners.get(name) || []) handler({ detail });
    },
    calls,
    listenerCount: name => listeners.get(name)?.size || 0
  };
  globalThis.window = win;
  return win;
}

afterEach(() => {
  globalThis.window = originalWindow;
});

test("Phase 7: same turn start is idempotent and does not double-open duplex", () => {
  const win = makeWindow();
  const controller = new DuplexController();

  assert.equal(controller.start(7), true);
  assert.equal(controller.start(7), true);
  assert.deepEqual(win.calls, [["start", 7]]);
  assert.equal(controller.getTurn(), 7);
  assert.equal(controller.isActive(), true);
});

test("Phase 7: changing turns closes the old duplex owner before starting the new turn", () => {
  const win = makeWindow();
  const controller = new DuplexController();

  controller.start(7);
  controller.start(8);

  assert.deepEqual(win.calls, [["start", 7], ["stop"], ["start", 8]]);
  assert.equal(controller.getTurn(), 8);
});

test("Phase 7: stale duplex events cannot mutate the active turn", () => {
  const win = makeWindow();
  let barged = 0;
  const controller = new DuplexController({ onInterruptDetected: () => { barged += 1; } });

  controller.start(9);
  win.emit(DUPLEX_EVENTS.BARGE_IN, { turn: 8 });
  assert.equal(barged, 0);
  assert.equal(controller.state, DUPLEX_STATES.CAPTURING);

  win.emit(DUPLEX_EVENTS.BARGE_IN, { turn: 9 });
  assert.equal(barged, 1);
  assert.equal(controller.state, DUPLEX_STATES.BARGE_IN);
});

test("Phase 7: destroy unbinds the controller and releases duplex", () => {
  const win = makeWindow();
  const controller = new DuplexController();
  controller.start(11);

  assert.equal(win.listenerCount(DUPLEX_EVENTS.READY), 1);
  assert.equal(win.listenerCount(DUPLEX_EVENTS.BARGE_IN), 1);
  assert.equal(win.listenerCount(DUPLEX_EVENTS.ERROR), 1);

  controller.destroy();

  assert.equal(win.listenerCount(DUPLEX_EVENTS.READY), 0);
  assert.equal(win.listenerCount(DUPLEX_EVENTS.BARGE_IN), 0);
  assert.equal(win.listenerCount(DUPLEX_EVENTS.ERROR), 0);
  assert.equal(controller.isActive(), false);
  assert.equal(controller.start(12), false);
  assert.deepEqual(win.calls, [["start", 11], ["stop"]]);
});

test("Phase 7: legacy duplex bridge aliases are retired", () => {
  const source = readFileSync(
    new URL("../android/app/src/main/java/com/haiva/bridge/HaivaBridge.kt", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(DuplexController.toString(), /startInterruptMonitor/);
  assert.doesNotMatch(source, /startDuplexInterruptMonitor|stopDuplexInterruptMonitor/);
});
