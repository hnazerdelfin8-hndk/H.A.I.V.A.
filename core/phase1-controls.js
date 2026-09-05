// =========================================
// H.A.I.V.A. PHASE 1 CONTROL WIRING
// =========================================
// Surgical compatibility layer: keeps the existing UI untouched while
// connecting the visible controls to the live HAIVA application instance.

function wirePhase1Controls() {
  const app = window.HAIVA;
  if (!app) {
    console.warn("[HAIVA] Phase 1 controls: app instance not ready.");
    return;
  }

  // The current main app registers the mic button with handleButtonClick(),
  // but that compatibility method was missing from the HAIVA class.
  // Restore that contract without changing the UI or voice pipeline.
  if (typeof app.handleButtonClick !== "function") {
    app.handleButtonClick = function handleButtonClick() {
      return this.activateVoice();
    };
  }

  const mic = document.getElementById("activate-voice");
  if (mic) {
    mic.disabled = false;
    mic.setAttribute("aria-disabled", "false");
  }

  // Keep chat usable even on WebViews where HTMLFormElement.requestSubmit()
  // is unavailable. The existing submit handler remains the primary path.
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const send = document.getElementById("send-message");
  if (form && input && send && !send.dataset.haivaPhase1Wired) {
    send.dataset.haivaPhase1Wired = "true";
    send.addEventListener("click", event => {
      if (typeof form.requestSubmit === "function") return;
      event.preventDefault();
      const text = input.value.trim();
      if (!text || app.isProcessing) return;
      input.value = "";
      void app.handleTextCommand(text);
    });
  }

  console.log("[HAIVA] Phase 1 controls wired: microphone + chat.");
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", wirePhase1Controls, { once: true });
} else {
  wirePhase1Controls();
}
