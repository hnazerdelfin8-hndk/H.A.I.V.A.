import assert from "node:assert/strict";
import { test } from "node:test";
import { SpeechOperation } from "../core/voice/speech-operation.js";

test("SpeechOperation completes a normal speech turn", async () => {
  const operation = new SpeechOperation({
    speakFn: async () => {},
    cancelFn: () => {}
  });
  const result = await operation.start("hello", 7);
  assert.equal(result.cancelled, false);
  assert.equal(result.turn, 7);
  assert.equal(operation.isActive(), false);
});

test("SpeechOperation cancellation settles the active operation", async () => {
  let resolveSpeech;
  let cancelled = false;
  const operation = new SpeechOperation({
    speakFn: () => new Promise(resolve => { resolveSpeech = resolve; }),
    cancelFn: () => { cancelled = true; }
  });

  const pending = operation.start("long answer", 3);
  assert.equal(operation.isActive(3), true);
  assert.equal(operation.cancel(3), true);
  const result = await pending;

  assert.equal(cancelled, true);
  assert.equal(result.cancelled, true);
  assert.equal(operation.isActive(), false);

  resolveSpeech();
  await Promise.resolve();
  assert.equal(operation.isActive(), false);
});

test("SpeechOperation rejects stale completion from a previous turn", async () => {
  let firstResolve;
  let secondResolve;
  const operation = new SpeechOperation({
    speakFn: text => new Promise(resolve => {
      if (text === "first") firstResolve = resolve;
      else secondResolve = resolve;
    }),
    cancelFn: () => {}
  });

  const first = operation.start("first", 1);
  const second = operation.start("second", 2);

  const firstResult = await first;
  assert.equal(firstResult.cancelled, true);

  secondResolve();
  const secondResult = await second;
  assert.equal(secondResult.cancelled, false);
  assert.equal(secondResult.turn, 2);

  firstResolve();
  await Promise.resolve();
  assert.equal(operation.isActive(), false);
});

test("SpeechOperation ignores cancellation for a stale turn", async () => {
  let resolveSpeech;
  const operation = new SpeechOperation({
    speakFn: () => new Promise(resolve => { resolveSpeech = resolve; }),
    cancelFn: () => {}
  });

  const pending = operation.start("answer", 9);
  assert.equal(operation.cancel(8), false);
  resolveSpeech();
  const result = await pending;
  assert.equal(result.cancelled, false);
});
