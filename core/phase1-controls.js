// =========================================
// H.A.I.V.A. PHASE 1 — RUNTIME-SAFE CONTROL BRIDGE
// =========================================
// Phase 1 owns the visible mic/chat controls, but it must never hide a
// core-load failure. Controls delegate to the live HAIVA instance only when
// the runtime is actually initialized.

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

  const reportCoreUnavailable = (control) => {
    showRuntimeError(`Core runtime failed before ${control} control became active.`);
  };

  const runText = (text) => {
    const app = getApp();
    if (!app || typeof app.handleTextCommand !== "function") {
      reportCoreUnavailable("chat");
      return;
    }
    if (!text || app.isProcessing) return;
    void app.handleTextCommand(text);
  };

  // Runtime proof: Phase 1 records the first JavaScript/module failure and
  // verifies that the core actually publishes window.HAIVA after boot.
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
      reportCoreUnavailable("Phase 1");
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
    if (mic) {
      const app = getApp();
      if (!app || typeof app.activateVoice !== "function") {
        event.preventDefault();
        event.stopImmediatePropagation();
        reportCoreUnavailable("microphone");
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      Promise.resolve(app.activateVoice()).catch(error => {
        console.error("[HAIVA] Microphone control failed:", error);
        app.setState?.("VOICE ERROR");
      });
      return;
    }

    const send = target.closest("#send-message");
    if (send) {
      const app = getApp();
      if (!app || typeof app.handleTextCommand !== "function") {
        event.preventDefault();
        event.stopImmediatePropagation();
        reportCoreUnavailable("chat");
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const input = document.getElementById("chat-input");
      const text = input?.value?.trim();
      if (input && text && !app.isProcessing) {
        input.value = "";
        runText(text);
      }
      return;
    }
  }, true);

  document.addEventListener("submit", event => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form || form.id !== "chat-form") return;

    const app = getApp();
    if (!app || typeof app.handleTextCommand !== "function") {
      event.preventDefault();
      event.stopImmediatePropagation();
      reportCoreUnavailable("chat");
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    const input = document.getElementById("chat-input");
    const text = input?.value?.trim();
    if (!text || app.isProcessing) return;

    input.value = "";
    runText(text);
  }, true);

  console.log("[HAIVA] Phase 1 runtime-safe controls installed: mic + chat.");
})();
