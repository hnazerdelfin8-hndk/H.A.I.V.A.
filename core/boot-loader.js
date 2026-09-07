// H.A.I.V.A. Boot Loader
// Responsibility: establish the startup handoff from the document into the
// boot runtime. It owns LOADING -> BOOTING only; boot.js owns boot execution.

import { bootCheckpoint } from "./boot-diagnostics.js";

const status = document.getElementById("haiva-status");
const heard = document.getElementById("heard");
const conversationState = document.querySelector(".online");

function setLoadingUI() {
  document.body.dataset.haivaState = "loading";
  if (status) status.textContent = "LOADING";
  if (heard) heard.textContent = "Loading H.A.I.V.A. core…";
  if (conversationState) conversationState.textContent = "● LOADING";
}

bootCheckpoint("BOOT_LOADER_STARTED");
setLoadingUI();
bootCheckpoint("LOADING_UI_READY");

function handoffToBoot() {
  bootCheckpoint("BOOT_LOADER_HANDOFF");
  document.body.dataset.haivaState = "booting";
  if (status) status.textContent = "BOOTING";
  if (heard) heard.textContent = "Initializing H.A.I.V.A. core…";
  if (conversationState) conversationState.textContent = "● CORE STARTING";

  return import("./boot.js");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void handoffToBoot().catch(error => {
      bootCheckpoint("BOOT_LOADER_HANDOFF_FAILED", error?.message || error);
      document.body.dataset.haivaState = "error";
      if (status) status.textContent = "ERROR";
      if (heard) heard.textContent = "H.A.I.V.A. could not start.";
      if (conversationState) conversationState.textContent = "● CORE ERROR";
    });
  }, { once: true });
} else {
  void handoffToBoot().catch(error => {
    bootCheckpoint("BOOT_LOADER_HANDOFF_FAILED", error?.message || error);
    document.body.dataset.haivaState = "error";
    if (status) status.textContent = "ERROR";
    if (heard) heard.textContent = "H.A.I.V.A. could not start.";
    if (conversationState) conversationState.textContent = "● CORE ERROR";
  });
}
