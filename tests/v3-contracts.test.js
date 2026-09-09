import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("V3 is an isolated stopper contract, not a second voice lifecycle", async () => {
  const v3 = await read("core/voice/interaction/v3/stopper.js");
  const v2 = await read("core/voice/interaction/v2/interaction.js");
  const app = await read("core/app.js");

  assert.match(v3, /haiva:v3-voice-stop/);
  assert.match(v3, /haiva:v3-voice-command/);
  assert.match(v3, /haiva:v3-voice-interrupted/);
  assert.match(v3, /V2_EVENTS\.DEACTIVATE/);
  assert.match(v3, /app\.handleResultText/);
  assert.doesNotMatch(v3, /setTimeout\(/);
  assert.match(v2, /haiva:v2-voice-activate/);
  assert.match(v2, /haiva:v2-voice-deactivate/);
  assert.match(app, /this\.startListening\(\)/);
});

test("V3 stopper remains dormant unless an explicit V3 event is dispatched", async () => {
  const polish = await read("ui/polish.js");
  const v3 = await read("core/voice/interaction/v3/stopper.js");

  assert.match(polish, /installV3VoiceStopper/);
  assert.match(v3, /V3_EVENTS\.STOP/);
  assert.match(v3, /V3_EVENTS\.COMMAND/);
  assert.doesNotMatch(polish, /V3_EVENTS\.STOP/);
  assert.doesNotMatch(polish, /dispatchV3Event\(V3_EVENTS\.STOP/);
});

test("V3 stop delegates deactivation to the existing V2 boundary", async () => {
  const v3 = await read("core/voice/interaction/v3/stopper.js");
  assert.match(v3, /dispatchV2Event\(V2_EVENTS\.DEACTIVATE, \{ source: "v3-stop" \}\)/);
  assert.match(v3, /dispatchV3Event\(V3_EVENTS\.INTERRUPTED/);
});
