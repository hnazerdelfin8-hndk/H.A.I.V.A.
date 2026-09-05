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

  const reportCoreUnavailable = (control) => {
    console.error(`[HAIVA] Phase 1 ${control} control: window.HAIVA is unavailable.`);
    const status = document.getElementById("haiva-status");
    const heard = document.getElementById("heard");
    if (status) status.textContent = "CORE ERROR";
    if (heard) heard.textContent = `Core runtime failed before ${control} control became active.`;
    document.body.dataset.haivaState = "error";
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

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const mic = target.closest("#activate-voice");
    if (mic) {
      const app = getApp();
      // Do not swallow the event if the core failed to load. This keeps the
      // failure observable instead of making the button appear silently dead.
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
