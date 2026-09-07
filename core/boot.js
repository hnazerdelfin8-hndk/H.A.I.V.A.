// H.A.I.V.A. boot boundary guard.
// Owns only module-load/boot-failure reporting; core/app.js remains the
// canonical owner of the runtime state machine after it loads.

const BOOT_TIMEOUT_MS = 10000;
const status = document.getElementById("haiva-status");
const heard = document.getElementById("heard");
const conversationState = document.querySelector(".online");
const input = document.getElementById("chat-input");
const send = document.getElementById("send-message");
const mic = document.getElementById("activate-voice");

function setBootUI(state, message, conversation) {
  document.body.dataset.haivaState = state.toLowerCase();
  if (status) status.textContent = state;
  if (heard) heard.textContent = message;
  if (conversationState && conversation) conversationState.textContent = conversation;
}

function syncControls() {
  const ready = document.body.dataset.haivaState === "ready";
  if (input) input.disabled = !ready;
  if (send) send.disabled = !ready;
  if (mic) mic.disabled = !ready;
}

function failBoot(reason) {
  console.error("[HAIVA-BOOT] Boot failure:", reason);
  setBootUI("ERROR", "H.A.I.V.A. core failed to start. Check the runtime error and rebuild.", "● CORE ERROR");
  syncControls();
}

setBootUI("BOOTING", "Initializing H.A.I.V.A. core…", "● CORE STARTING");
syncControls();

window.addEventListener("error", event => {
  const target = event.target;
  if (target && target.tagName === "SCRIPT") failBoot(event.message || `Failed to load ${target.src}`);
  else if (event.error) failBoot(event.error);
}, true);

window.addEventListener("unhandledrejection", event => failBoot(event.reason || "Unhandled promise rejection"));

const observer = new MutationObserver(syncControls);
observer.observe(document.body, { attributes: true, attributeFilter: ["data-haiva-state"] });

const timeout = setTimeout(() => {
  if (document.body.dataset.haivaState === "booting") {
    failBoot(new Error(`Boot did not reach READY within ${BOOT_TIMEOUT_MS}ms`));
  }
}, BOOT_TIMEOUT_MS);

import("./app.js")
  .then(() => {
    clearTimeout(timeout);
    syncControls();
  })
  .catch(failBoot);
