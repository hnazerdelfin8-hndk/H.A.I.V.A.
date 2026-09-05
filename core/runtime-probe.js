// =========================================
// H.A.I.V.A. RUNTIME PROBE — PHASE 1
// =========================================
// Loaded before the application modules so Android WebView failures are
// observable even when app.js fails during module evaluation/import.
(() => {
  if (window.__HAIVA_RUNTIME_PROBE__) return;
  window.__HAIVA_RUNTIME_PROBE__ = true;
  window.__HAIVA_RUNTIME__ = {
    probeLoaded: true,
    appCreated: false,
    lastError: null
  };

  const report = (message) => {
    window.__HAIVA_RUNTIME__.lastError = String(message);
    console.error("[HAIVA][RUNTIME-PROBE]", message);
    const status = document.getElementById("haiva-status");
    const heard = document.getElementById("heard");
    if (status) status.textContent = "CORE ERROR";
    if (heard) heard.textContent = `Runtime diagnostic: ${String(message)}`;
    if (document.body) document.body.dataset.haivaState = "error";
  };

  window.addEventListener("error", event => {
    const message = event?.error?.message || event?.message || "Unknown JavaScript error";
    report(message);
  });

  window.addEventListener("unhandledrejection", event => {
    const reason = event?.reason?.message || event?.reason || "Unknown promise rejection";
    report(reason);
  });

  const verify = () => {
    if (window.HAIVA) {
      window.__HAIVA_RUNTIME__.appCreated = true;
      console.log("[HAIVA][RUNTIME-PROBE] window.HAIVA created.");
    } else if (!window.__HAIVA_RUNTIME__.lastError) {
      report("window.HAIVA was not created after DOMContentLoaded.");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(verify, 0), { once: true });
  } else {
    setTimeout(verify, 0);
  }
})();
