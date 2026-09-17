import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("boot loader hands off immediately and does not own a second timeout", async () => {
  const source = await read("core/boot-loader.js");
  assert.match(source, /core\/boot\.js\s+remains\s+the\s*\/\/\s*single\s+startup\s+authority/);
  assert.match(source, /void handoffToBoot\(\);/);
  assert.doesNotMatch(source, /BOOT_TIMEOUT_MS\s*=\s*15000/);
  assert.doesNotMatch(source, /bootTimer\s*=\s*setTimeout/);
  assert.doesNotMatch(source, /document\.addEventListener\(\s*["']DOMContentLoaded["'][\s\S]*handoffToBoot/);
});

test("initializer never converts a core failure into READY", async () => {
  const source = await read("core/initializer.js");
  assert.match(source, /haiva:boot-failure/);
  assert.match(source, /stage:\s*["']INITIALIZER_FAILED["']/);
  assert.match(source, /throw error/);
  assert.doesNotMatch(source, /return \{ ready:\s*true, degraded:\s*true, warnings:\s*\[error\]/);
});

test("runtime probes do not compete with the boot controller", async () => {
  const probe = await read("core/runtime-probe.js");
  const controls = await read("core/phase1-controls.js");
  assert.doesNotMatch(probe, /window\.addEventListener\(\s*["']error["']/);
  assert.doesNotMatch(probe, /window\.addEventListener\(\s*["']unhandledrejection["']/);
  assert.doesNotMatch(controls, /window\.addEventListener\(\s*["']error["']/);
  assert.doesNotMatch(controls, /window\.addEventListener\(\s*["']unhandledrejection["']/);
});

test("boot controller retains one authoritative timeout and fatal gate", async () => {
  const source = await read("core/boot.js");
  assert.match(source, /const BOOT_TIMEOUT_MS = 10000/);
  assert.match(source, /let fatalBoot = false/);
  assert.match(source, /!fatalBoot/);
  assert.match(source, /haiva:boot-failure/);
});
