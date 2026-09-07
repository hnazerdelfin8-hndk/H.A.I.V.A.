// H.A.I.V.A. Boot Loader
// Responsibility: own the isolated loading phase and startup handoff.
// The main H.A.I.V.A. UI stays hidden until the runtime reaches READY.

import { bootCheckpoint } from "./boot-diagnostics.js";

const status = document.getElementById("haiva-status");
const heard = document.getElementById("heard");
const conversationState = document.querySelector(".online");

const BOOT_TIMEOUT_MS = 15000;
let bootTimer = null;
let finished = false;
let loadingOverlay = null;

function createLoadingOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "haiva-boot-screen";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="haiva-boot-card">
      <div class="haiva-boot-name">H.A.I.V.A.</div>
      <div class="haiva-boot-subtitle">HNazer Artificial Intelligence Voice Assistant</div>
      <div class="haiva-boot-status" id="haiva-boot-status">INITIALIZING</div>
      <div class="haiva-boot-message" id="haiva-boot-message">Loading H.A.I.V.A. core…</div>
      <div class="haiva-boot-steps" id="haiva-boot-steps">
        <div>● Starting application</div>
        <div>○ Loading H.A.I.V.A. core</div>
        <div>○ Preparing runtime</div>
        <div>○ Launching interface</div>
      </div>
      <div class="haiva-boot-error" id="haiva-boot-error" hidden></div>
      <button id="haiva-boot-retry" type="button" hidden>RETRY</button>
    </div>`;

  const style = document.createElement("style");
  style.textContent = `
    #haiva-boot-screen { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 24px; background: #05070b; color: #fff; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .haiva-boot-card { width: min(560px, 100%); padding: 32px; border: 1px solid rgba(255,255,255,.14); border-radius: 20px; background: rgba(12,16,24,.96); box-shadow: 0 20px 80px rgba(0,0,0,.45); }
    .haiva-boot-name { font-size: 30px; font-weight: 800; letter-spacing: .08em; }
    .haiva-boot-subtitle { margin-top: 6px; opacity: .65; font-size: 13px; }
    .haiva-boot-status { margin-top: 28px; font-size: 12px; font-weight: 800; letter-spacing: .18em; }
    .haiva-boot-message { margin-top: 10px; font-size: 18px; }
    .haiva-boot-steps { margin-top: 24px; display: grid; gap: 10px; font-size: 14px; opacity: .78; }
    .haiva-boot-error { margin-top: 22px; padding: 14px; border-radius: 12px; background: rgba(255,60,60,.10); border: 1px solid rgba(255,90,90,.35); white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
    #haiva-boot-retry { margin-top: 18px; padding: 11px 18px; border: 0; border-radius: 10px; cursor: pointer; font-weight: 800; }
  `;
  overlay.appendChild(style);
  document.body.appendChild(overlay);
  loadingOverlay = overlay;
  return overlay;
}

function setLoadingUI(message = "Loading H.A.I.V.A. core…", step = "Loading H.A.I.V.A. core") {
  document.body.dataset.haivaState = "loading";
  if (status) status.textContent = "LOADING";
  if (heard) heard.textContent = message;
  if (conversationState) conversationState.textContent = "● LOADING";
  const overlayStatus = document.getElementById("haiva-boot-status");
  const overlayMessage = document.getElementById("haiva-boot-message");
  const steps = document.getElementById("haiva-boot-steps");
  if (overlayStatus) overlayStatus.textContent = "INITIALIZING";
  if (overlayMessage) overlayMessage.textContent = message;
  if (steps) steps.innerHTML = `<div>✓ Starting application</div><div>● ${step}</div><div>○ Preparing runtime</div><div>○ Launching interface</div>`;
}

function showError(reason, stage = "BOOT_FAILED") {
  if (finished) return;
  finished = true;
  if (bootTimer) clearTimeout(bootTimer);
  const message = reason?.message || String(reason || "Unknown startup error");
  bootCheckpoint(stage, message);
  console.error("[HAIVA-BOOT]", stage, reason);
  document.body.dataset.haivaState = "error";
  if (status) status.textContent = "ERROR";
  if (heard) heard.textContent = `H.A.I.V.A. failed to start: ${message}`;
  if (conversationState) conversationState.textContent = "● CORE ERROR";

  const overlayStatus = document.getElementById("haiva-boot-status");
  const overlayMessage = document.getElementById("haiva-boot-message");
  const overlayError = document.getElementById("haiva-boot-error");
  const retry = document.getElementById("haiva-boot-retry");
  if (overlayStatus) overlayStatus.textContent = "INITIALIZATION ERROR";
  if (overlayMessage) overlayMessage.textContent = "H.A.I.V.A. could not complete startup.";
  if (overlayError) {
    overlayError.hidden = false;
    overlayError.textContent = `ERROR: ${message}\nSTEP: ${stage}`;
  }
  if (retry) {
    retry.hidden = false;
    retry.addEventListener("click", () => window.location.reload(), { once: true });
  }
}

function finishReady() {
  if (finished || document.body.dataset.haivaState !== "ready") return;
  finished = true;
  if (bootTimer) clearTimeout(bootTimer);
  bootCheckpoint("BOOT_LOADER_READY", "runtime reached READY; revealing H.A.I.V.A. UI");
  if (loadingOverlay) {
    loadingOverlay.remove();
    loadingOverlay = null;
  }
}

bootCheckpoint("BOOT_LOADER_STARTED");
createLoadingOverlay();
setLoadingUI();
bootCheckpoint("LOADING_UI_READY");

window.addEventListener("error", event => {
  if (finished) return;
  const target = event.target;
  if (target && target.tagName === "SCRIPT") showError(new Error(event.message || `Failed to load ${target.src}`), "SCRIPT_LOAD_FAILED");
  else if (event.error) showError(event.error, "RUNTIME_ERROR");
}, true);

window.addEventListener("unhandledrejection", event => {
  if (!finished) showError(event.reason || "Unhandled promise rejection", "UNHANDLED_REJECTION");
});

const observer = new MutationObserver(() => {
  const state = document.body.dataset.haivaState || "unknown";
  if (state === "ready") finishReady();
  else if (state === "error") showError("Runtime entered ERROR state", "RUNTIME_ERROR_STATE");
});
observer.observe(document.body, { attributes: true, attributeFilter: ["data-haiva-state"] });

bootTimer = setTimeout(() => {
  if (!finished && document.body.dataset.haivaState !== "ready") {
    showError(new Error(`Boot did not reach READY within ${BOOT_TIMEOUT_MS}ms`), "BOOT_TIMEOUT");
  }
}, BOOT_TIMEOUT_MS);

async function handoffToBoot() {
  bootCheckpoint("BOOT_LOADER_HANDOFF");
  setLoadingUI("Starting H.A.I.V.A. runtime…", "Starting runtime");
  try {
    await import("./boot.js");
    bootCheckpoint("BOOT_MODULE_LOADED");
  } catch (error) {
    showError(error, "BOOT_MODULE_LOAD_FAILED");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void handoffToBoot(), { once: true });
} else {
  void handoffToBoot();
}
