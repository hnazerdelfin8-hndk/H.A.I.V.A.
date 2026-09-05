import "./runtime-probe.js";

// =========================================
// H.A.I.V.A. PHASE 1 — RUNTIME-SAFE VOICE CONTROL
// =========================================
// Phase 1 owns the visible microphone control only.
// Chat remains owned by core/app.js so Voice and Chat each have one owner.

(() => {
  if (window.__HAIVA_PHASE1_CONTROLS__) return;
  window.__HAIVA_PHASE1_CONTROLS__ = true;

  const getApp = () => window.HAIVA || null;

  const showRuntimeError = (message) => {
    console.error("[HAIVA][RUNTIME]", message);
    const status = document.getElementById("haiva-status");
    const heard = document.getElementById("heard");
    if (status) status.textContent = "CORE ERROR";
    if (heard) heard.textContent = message;
    document.body.dataset.haivaState = "error";
  };

  const reportCoreUnavailable = () => {
    showRuntimeError("Core runtime failed before microphone control became active.");
  };

  window.addEventListener("error", event => {
    const detail = event?.error?.stack || event?.message || "Unknown JavaScript error";
    showRuntimeError(`JavaScript runtime error: ${String(detail).split("\n")[0]}`);
  });

  window.addEventListener("unhandledrejection", event => {
    const reason = event?.reason?.stack || event?.reason?.message || event?.reason || "Unknown promise rejection";
    showRuntimeError(`Initialization error: ${String(reason).split("\n")[0]}`);
  });

  const verifyCore = () => {
    if (!getApp()) {
      reportCoreUnavailable();
      return false;
    }
    console.log("[HAIVA][RUNTIME] window.HAIVA verified; Phase 1 synced.");
    return true;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(verifyCore, 0), { once: true });
  } else {
    setTimeout(verifyCore, 0);
  }

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const mic = target.closest("#activate-voice");
    if (!mic) return;

    const app = getApp();
    if (!app || typeof app.activateVoice !== "function") {
      event.preventDefault();
      event.stopImmediatePropagation();
      reportCoreUnavailable();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    Promise.resolve(app.activateVoice()).catch(error => {
      console.error("[HAIVA] Microphone control failed:", error);
      app.setState?.("VOICE ERROR");
    });
  }, true);

  console.log("[HAIVA] Phase 1 runtime-safe voice control installed.");
})();
