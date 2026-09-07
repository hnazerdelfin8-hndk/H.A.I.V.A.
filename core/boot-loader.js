// H.A.I.V.A. Boot Loader
// Owns the isolated boot presentation and hands off to core/boot.js.
// core/boot.js is the single startup authority for the H.A.I.V.A. boot chain.

import { bootCheckpoint } from "./boot-diagnostics.js";

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
      <div class="haiva-boot-subtitle">Hnazer Artificial Intelligence Voice Assistant</div>
      <div class="haiva-boot-status" id="haiva-boot-status">INITIALIZING</div>
      <div class="haiva-boot-message" id="haiva-boot-message">Loading H.A.I.V.A. core…</div>
      <div class="haiva-boot-progress"><div id="haiva-boot-progress-bar"></div></div>
      <div class="haiva-boot-percent" id="haiva-boot-percent">0%</div>
      <div class="haiva-boot-steps" id="haiva-boot-steps">
        <div id="boot-step-app">● Starting application</div>
        <div id="boot-step-core">○ Loading H.A.I.V.A. core</div>
        <div id="boot-step-runtime">○ Preparing runtime</div>
        <div id="boot-step-interface">○ Launching interface</div>
      </div>
      <div class="haiva-boot-error" id="haiva-boot-error" hidden></div>
      <button id="haiva-boot-retry" type="button" hidden>RETRY</button>
    </div>`;

  const style = document.createElement("style");
  style.textContent = `
    #haiva-boot-screen{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#05070b;color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .haiva-boot-card{width:min(560px,100%);padding:32px;border:1px solid rgba(255,255,255,.14);border-radius:20px;background:rgba(12,16,24,.98);box-shadow:0 20px 80px rgba(0,0,0,.45)}
    .haiva-boot-name{font-size:30px;font-weight:800;letter-spacing:.08em}.haiva-boot-subtitle{margin-top:6px;opacity:.65;font-size:13px}
    .haiva-boot-status{margin-top:28px;font-size:12px;font-weight:800;letter-spacing:.18em}.haiva-boot-message{margin-top:10px;font-size:18px}
    .haiva-boot-progress{height:8px;margin-top:24px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.12)}
    #haiva-boot-progress-bar{width:0%;height:100%;border-radius:inherit;background:#fff;transition:width .35s ease}
    .haiva-boot-percent{margin-top:10px;text-align:right;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
    .haiva-boot-steps{margin-top:24px;display:grid;gap:10px;font-size:14px;opacity:.78}.haiva-boot-error{margin-top:22px;padding:14px;border-radius:12px;background:rgba(255,60,60,.1);border:1px solid rgba(255,90,90,.35);white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
    #haiva-boot-retry{margin-top:18px;padding:11px 18px;border:0;border-radius:10px;cursor:pointer;font-weight:800}
  `;
  overlay.appendChild(style);
  document.body.appendChild(overlay);
  loadingOverlay = overlay;
}

function setProgress(percent, message, step) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  const bar = document.getElementById("haiva-boot-progress-bar");
  const label = document.getElementById("haiva-boot-percent");
  const text = document.getElementById("haiva-boot-message");
  if (bar) bar.style.width = `${value}%`;
  if (label) label.textContent = `${Math.round(value)}%`;
  if (text && message) text.textContent = message;
  if (step) {
    const ids = ["boot-step-app","boot-step-core","boot-step-runtime","boot-step-interface"];
    const index = Math.max(0, Math.min(ids.length - 1, Number(step)));
    ids.forEach((id, i) => { const el = document.getElementById(id); if (el) el.textContent = `${i < index ? "✓" : i === index ? "●" : "○"} ${el.textContent.slice(2)}`; });
  }
}

window.haivaBootProgress = setProgress;

function showError(reason, stage = "BOOT_FAILED") {
  if (finished) return;
  finished = true;
  const message = reason?.message || String(reason || "Unknown startup error");
  bootCheckpoint(stage, message);
  console.error("[HAIVA-BOOT]", stage, reason);
  setProgress(0, "H.A.I.V.A. could not complete startup.", 0);
  const status = document.getElementById("haiva-boot-status");
  const error = document.getElementById("haiva-boot-error");
  const retry = document.getElementById("haiva-boot-retry");
  if (status) status.textContent = "INITIALIZATION ERROR";
  if (error) { error.hidden = false; error.textContent = `ERROR: ${message}\nSTEP: ${stage}`; }
  if (retry) { retry.hidden = false; retry.addEventListener("click", () => window.location.reload(), { once: true }); }
}

function finishReady() {
  if (finished || document.body.dataset.haivaState !== "ready") return;
  finished = true;
  setProgress(100, "H.A.I.V.A. core is online. Ready, Master.", 4);
  bootCheckpoint("BOOT_LOADER_READY", "runtime reached READY; revealing H.A.I.V.A. UI");
  setTimeout(() => { loadingOverlay?.remove(); loadingOverlay = null; }, 450);
}

bootCheckpoint("BOOT_LOADER_STARTED");
createLoadingOverlay();
setProgress(8, "Starting H.A.I.V.A. application…", 0);
bootCheckpoint("LOADING_UI_READY");

window.addEventListener("haiva:boot-failure", event => showError(event.detail?.message || "H.A.I.V.A. core failed during startup.", event.detail?.stage || "BOOT_FAILED"), true);

const observer = new MutationObserver(() => {
  const state = document.body.dataset.haivaState || "unknown";
  if (state === "ready") finishReady();
});
observer.observe(document.body, { attributes: true, attributeFilter: ["data-haiva-state"] });

async function handoffToBoot() {
  bootCheckpoint("BOOT_LOADER_HANDOFF");
  setProgress(18, "Loading H.A.I.V.A. boot runtime…", 1);
  try {
    await import("./boot.js");
    setProgress(30, "Preparing H.A.I.V.A. core…", 2);
    bootCheckpoint("BOOT_MODULE_LOADED");
  } catch (error) {
    showError(error, "BOOT_MODULE_LOAD_FAILED");
  }
}

void handoffToBoot();
