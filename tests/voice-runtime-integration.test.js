import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { VoiceInteraction } from "../core/voice/interaction/index.js";

const originalWindow = globalThis.window;

function makeNativeWindow() {
  const listeners = new Map();
  const calls = [];
  let nextSessionId = 0;
  const win = {
    HaivaBridge: {
      startDuplexAudio: turn => { calls.push(["duplex-start", Number(turn)]); },
      stopDuplexAudio: () => { calls.push(["duplex-stop"]); },
      startVoiceCapture: () => { calls.push(["asr-start"]); },
      stopVoiceCapture: () => { calls.push(["asr-stop"]); },
      speak: text => { calls.push(["tts-start", text]); },
      stopSpeaking: () => { calls.push(["tts-stop"]); }
    },
    addEventListener: (name, handler) => {
      const set = listeners.get(name) || new Set();
      set.add(handler);
      listeners.set(name, set);
    },
    removeEventListener: (name, handler) => listeners.get(name)?.delete(handler),
    dispatchEvent: event => {
      for (const handler of listeners.get(event.type) || []) handler(event);
      return true;
    },
    emit: (name, detail = {}) => {
      const event = new CustomEvent(name, { detail });
      win.dispatchEvent(event);
    },
    calls
  };
  return {
    win,
    emit: win.emit,
    calls,
    nextSession: () => ++nextSessionId
  };
}

afterEach(() => {
  globalThis.window = originalWindow;
});

test("Phase 12: end-to-end native barge-in hands the physical mic from duplex to ASR", async () => {
  const mock = makeNativeWindow();
  globalThis.window = mock.win;

  let decisions = 0;
  const interaction = new VoiceInteraction({
    onBrainDecision: () => {
      decisions += 1;
      return { action: "interrupt", instruction: "continue" };
    }
  });

  assert.equal(interaction.activate(), true);
  interaction.beginProcessing();
  const speaking = interaction.beginSpeaking("long response");
  await Promise.resolve();

  mock.calls.length = 0;
  const turn = interaction.turn;
  mock.emit("haiva:duplex-ready", { turn });
  mock.emit("haiva:duplex-barge-in", { turn, source: "native-duplex-vad" });

  const events = mock.calls.map(call => call[0]);
  assert.deepEqual(events.slice(0, 5), [
    "tts-start",
    "tts-stop",
    "duplex-stop",
    "asr-start"
  ].slice(0, 4));
  const duplexStopIndex = events.lastIndexOf("duplex-stop");
  const asrStartIndex = events.lastIndexOf("asr-start");
  const ttsStopIndex = events.lastIndexOf("tts-stop");
  assert.ok(ttsStopIndex >= 0);
  assert.ok(duplexStopIndex >= 0);
  assert.ok(asrStartIndex >= 0);
  assert.ok(ttsStopIndex < asrStartIndex);
  assert.ok(duplexStopIndex < asrStartIndex);
  assert.equal(interaction.duplex.isActive(), false);
  assert.equal(interaction.duplexInterruptPending, true);

  const sessionId = mock.nextSession();
  mock.emit("haiva:native-voice-ready", { sessionId });
  mock.emit("haiva:native-voice-result", { sessionId, text: "stop and continue" });

  assert.equal(decisions, 1);
  assert.equal(interaction.turn > turn, true);
  assert.equal(interaction.speaking, false);

  interaction.deactivate();
  await speaking;
});

test("Phase 12: stale duplex barge-in cannot enter a later speaking turn", async () => {
  const mock = makeNativeWindow();
  globalThis.window = mock.win;

  let interruptions = 0;
  const interaction = new VoiceInteraction({
    onBrainDecision: () => {
      interruptions += 1;
      return { action: "interrupt", instruction: "" };
    }
  });

  assert.equal(interaction.activate(), true);
  interaction.beginProcessing();
  const speaking = interaction.beginSpeaking("response");
  await Promise.resolve();

  const oldTurn = interaction.turn;
  mock.emit("haiva:duplex-ready", { turn: oldTurn });
  interaction.turnFence.invalidate();
  interaction.turn = interaction.turnFence.begin();
  interaction.bargeIn.beginTurn();
  interaction.speaking = true;

  mock.emit("haiva:duplex-barge-in", { turn: oldTurn, source: "native-duplex-vad" });

  assert.equal(interruptions, 0);
  assert.equal(interaction.duplexInterruptPending, false);

  interaction.deactivate();
  await speaking;
});
