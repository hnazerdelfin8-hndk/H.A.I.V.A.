import "./runtime-probe.js";

// =========================================
// H.A.I.V.A. PHASE 1 — RUNTIME-SAFE VOICE CONTROL
// =========================================
// Phase 1 owns the visible microphone control only.
// Chat remains owned by core/app.js so Voice and Chat each have one owner.
// Connector recovery/boot diagnostics live here as a boundary observer;
// Core/app.js remains the owner of the canonical voice state machine.

(() => {
  if (window.__HAIVA_PHASE1_CONTROLS__) return;
  window.__HAIVA_PHASE1_CONTROLS__ = true;

  const getApp = () => window.HAIVA || null;

  const setBootCheckpoint = (name, ok, detail = "") => {
    document.body.dataset[`haiva${name}`] = ok ? "ok" : "error";
    console.log(`[HAIVA][BOOT] ${name} ${ok ? "OK" : "ERROR"}${detail ? ` — ${detail}` : ""}`);
  };

  const showRuntimeError = (message) => {
    console.error("[HAIVA][RUNTIME]", message);
    const status = document.getElementById("haiva-status");
    const heard = document.getElementById("heard");
    if (status) status.textContent = "CORE ERROR";
    if (heard) heard.textContent = message;
    document.body.dataset.haivaState = "error";
  };

  const reportCoreUnavailable = () => {
    setBootCheckpoint("BootCore", false, "window.HAIVA was not created");
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

  const verifyRuntimeBoundary = () => {
    setBootCheckpoint("BootHtml", true, "DOM available");
    const app = getApp();
    if (!app) return reportCoreUnavailable();

    setBootCheckpoint("BootCore", true, "window.HAIVA available");
    const connectorAvailable = !!window.HaivaBridge;
    setBootCheckpoint("BootConnector", connectorAvailable, connectorAvailable ? "HaivaBridge available" : "HaivaBridge unavailable");

    if (!connectorAvailable) {
      console.warn("[HAIVA][BOOT] Connector unavailable; browser voice path may still be available.");
    }
  };

  window.addEventListener("haiva:native-voice-unavailable", event => {
    const app = getApp();
    const reason = String(event.detail?.reason || "native_voice_unavailable");
    console.warn("[HAIVA][CONNECTOR] Native voice unavailable:", reason);
    if (app?.deactivateVoice) app.deactivateVoice();
    if (app?.setState) app.setState("VOICE UNAVAILABLE");
    document.body.dataset.haivaVoiceCapability = "unavailable";
  });

  window.addEventListener("haiva:native-voice-timeout", () => {
    document.body.dataset.haivaVoiceCapability = "timeout";
    console.warn("[HAIVA][CONNECTOR] Native voice watchdog timeout; Core recovery will return to READY.");
  });

  window.addEventListener("haiva:microphone-ready", () => {
    document.body.dataset.haivaMicrophone = "ready";
  });

  window.addEventListener("haiva:native-voice-ready", () => {
    document.body.dataset.haivaNativeVoice = "ready";
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(verifyRuntimeBoundary, 0), { once: true });
  } else {
    setTimeout(verifyRuntimeBoundary, 0);
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
