import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../android/app/src/main/java/com/haiva/app/MainActivity.kt", import.meta.url), "utf8");
const duplex = readFileSync(new URL("../android/app/src/main/java/com/haiva/app/DuplexAudioMonitor.kt", import.meta.url), "utf8");
const ownership = readFileSync(new URL("../android/app/src/main/java/com/haiva/app/MicOwnership.kt", import.meta.url), "utf8");

test("physical microphone has one native ownership guard", () => {
  assert.match(ownership, /AtomicReference/);
  assert.match(ownership, /\bASR\b/);
  assert.match(ownership, /Owner\.DUPLEX_VAD/);
  assert.match(ownership, /compareAndSet\(Owner\.NONE/);

  assert.equal((main.match(/SpeechRecognizer\.createSpeechRecognizer\(this\)/g) || []).length, 1);
  assert.match(main, /DuplexAudioMonitor\.stop\(\)[\s\S]*MicOwnership\.tryAcquire\(MicOwnership\.Owner\.ASR\)/);
  assert.match(main, /MicOwnership\.release\(MicOwnership\.Owner\.ASR\)/);
  assert.match(main, /stopNativeRecognition\(\)[\s\S]*DuplexAudioMonitor\.start\(this, turn\)/);
  assert.match(main, /DuplexAudioMonitor\.stop\(\)[\s\S]*MicOwnership\.tryAcquire\(MicOwnership\.Owner\.ASR/);
});

test("duplex monitor cannot acquire the microphone while ASR owns it", () => {
  assert.match(duplex, /MicOwnership\.tryAcquire\(MicOwnership\.Owner\.DUPLEX_VAD\)/);
  assert.match(duplex, /MicOwnership\.release\(MicOwnership\.Owner\.DUPLEX_VAD\)/);
  assert.match(duplex, /running\.get\(\)/);
});

test("activity teardown releases both native microphone paths", () => {
  assert.match(main, /MicOwnership\.release\(MicOwnership\.Owner\.ASR\)[\s\S]*DuplexAudioMonitor\.stop\(\)/);
});


test("duplex releases physical mic before dispatching barge-in", () => {
  const cleanupIndex = duplex.indexOf("cleanupRecorder(localRecorder)");
  const bargeInIndex = duplex.indexOf('"haiva:duplex-barge-in"');
  assert.ok(cleanupIndex >= 0);
  assert.ok(bargeInIndex >= 0);
  assert.ok(cleanupIndex < bargeInIndex);
});
