// =========================================
// H.A.I.V.A. PHASE 1 — HARDENED CONTROL BRIDGE
// =========================================
// This compatibility layer deliberately uses document-level capture listeners.
// Android WebView can occasionally deliver touch/click events differently from
// desktop browsers. Capturing the real controls here guarantees that the visible
// UI is connected to the live HAIVA instance without changing the UI markup.

(() => {
  if (window.__HAIVA_PHASE1_CONTROLS__) return;
  window.__HAIVA_PHASE1_CONTROLS__ = true;

  const getApp = () => window.HAIVA || null;

  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const mic = target.closest("#activate-voice");
    if (mic) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const app = getApp();
      if (app && typeof app.activateVoice === "function") {
        Promise.resolve(app.activateVoice()).catch(error => {
          console.error("[HAIVA] Microphone control failed:", error);
          app.setState?.("VOICE ERROR");
        });
      } else {
        console.warn("[HAIVA] Microphone pressed before core was ready.");
      }
      return;
    }

    const send = target.closest("#send-message");
    if (send) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const form = document.getElementById("chat-form");
      const input = document.getElementById("chat-input");
      const app = getApp();
      const text = input?.value?.trim();
      if (app && input && text && !app.isProcessing) {
        input.value = "";
        void app.handleTextCommand(text);
      } else if (!app) {
        console.warn("[HAIVA] Chat pressed before core was ready.");
      }
      return;
    }
  }, true);

  document.addEventListener("submit", event => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form || form.id !== "chat-form") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const input = document.getElementById("chat-input");
    const app = getApp();
    const text = input?.value?.trim();
    if (!text || !app || app.isProcessing) return;

    input.value = "";
    void app.handleTextCommand(text);
  }, true);

  console.log("[HAIVA] Hardened controls installed: mic + chat capture bridge.");
})();
