// H.A.I.V.A. boot boundary guard.
// Owns only module-load/boot-failure reporting; core/app.js remains the
// canonical owner of the runtime state machine after it loads.

import { bootCheckpoint } from "./boot-diagnostics.js";

const BOOT_TIMEOUT_MS = 10000;
const status = document.getElementById("haiva-status");
const heard = document.getElementById("heard");
const conversationState = document.querySelector(".online");
const input = document.getElementById("chat-input");
const send = document.getElementById("send-message");
const mic = document.getElementById("activate-voice");

let bootReadyConfirmed = false;
let fatalBoot = false;
let timeout = null;

function progress(percent, message, step) {
  try { window.haivaBootProgress?.(percent, message, step); }
  catch (error) { console.warn("[HAIVA-BOOT] progress update failed", error); }
}

bootCheckpoint("BOOT_MODULE_STARTED");
progress(38, "H.A.I.V.A. boot runtime loaded.", 1);

function setBootUI(state, message, conversation) {
  document.body.dataset.haivaState = state.toLowerCase();
  if (status) status.textContent = state;
  if (heard) heard.textContent = message;
  if (conversationState && conversation) conversationState.textContent = conversation;
}

function syncControls() {
  const ready = bootReadyConfirmed && !fatalBoot;
  if (input) input.disabled = !ready;
  if (send) send.disabled = !ready;
  if (mic) mic.disabled = !ready;
}

function failBoot(reason, stage = "BOOT_FAILED") {
  if (bootReadyConfirmed || fatalBoot) return;
  fatalBoot = true;
  const message = reason?.message || String(reason || "Unknown boot failure");
  bootCheckpoint(stage, message);
  progress(0, "H.A.I.V.A. startup failed. Check diagnostics.", 0);
  console.error("[HAIVA-BOOT] Boot failure:", reason);
  setBootUI("BOOTING", "H.A.I.V.A. is recovering startup…", "● CORE STARTING");
  syncControls();
}

function confirmBootReady(detail = {}) {
  if (fatalBoot || bootReadyConfirmed) return;
  bootReadyConfirmed = true;
  if (timeout) clearTimeout(timeout);
  bootCheckpoint("BOOT_READY", JSON.stringify(detail));
  bootCheckpoint("CORE_READY", "H.A.I.V.A. core startup gate passed");
  progress(100, "H.A.I.V.A. core is online. Ready, Master.", 4);
  setBootUI("READY", "H.A.I.V.A. core is online. Ready, Master.", "● CORE READY");
  syncControls();
}

setBootUI("BOOTING", "Initializing H.A.I.V.A. core…", "● CORE STARTING");
syncControls();
bootCheckpoint("BOOT_UI_INITIALIZED");
progress(42, "Initializing H.A.I.V.A. core…", 1);

window.addEventListener("haiva:boot-ready", event => confirmBootReady(event.detail || {}), true);
window.addEventListener("haiva:boot-failure", event => {
  const stage = event.detail?.stage || "BOOT_FAILED";
  const message = event.detail?.message || "H.A.I.V.A. core failed during startup.";
  fatalBoot = true;
  bootReadyConfirmed = false;
  if (timeout) clearTimeout(timeout);
  progress(0, `Startup failed: ${message}`, 0);
  console.error("[HAIVA-BOOT] Fatal checkpoint:", stage, message);
  setBootUI("BOOTING", "H.A.I.V.A. is recovering startup…", "● CORE STARTING");
  syncControls();
}, true);
window.addEventListener("error", event => {
  const target = event.target;
  if (target && target.tagName === "SCRIPT") failBoot(event.message || `Failed to load ${target.src}`, "SCRIPT_LOAD_FAILED");
  else if (event.error) failBoot(event.error, "RUNTIME_ERROR");
}, true);
window.addEventListener("unhandledrejection", event => failBoot(event.reason || "Unhandled promise rejection", "UNHANDLED_REJECTION"));

timeout = setTimeout(() => {
  if (!bootReadyConfirmed && !fatalBoot) failBoot(new Error(`Boot did not reach explicit CORE READY within ${BOOT_TIMEOUT_MS}ms`), "BOOT_TIMEOUT");
}, BOOT_TIMEOUT_MS);

import("./app.js")
  .then(() => {
    bootCheckpoint("APP_MODULE_LOADED");
    progress(68, "H.A.I.V.A. core module loaded. Preparing runtime…", 2);
    syncControls();
  })
  .catch(error => failBoot(error, "APP_MODULE_LOAD_FAILED"));
