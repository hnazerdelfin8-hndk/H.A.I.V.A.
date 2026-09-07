// =========================================
// H.A.I.V.A. RUNTIME PROBE — PHASE 1
// =========================================
// Records runtime visibility only. Startup errors are owned by core/boot.js.
(() => {
  if (window.__HAIVA_RUNTIME_PROBE__) return;
  window.__HAIVA_RUNTIME_PROBE__ = true;
  window.__HAIVA_RUNTIME__ = {
    probeLoaded: true,
    appCreated: false,
    lastError: null
  };

  const record = (message) => {
    window.__HAIVA_RUNTIME__.lastError = String(message);
    console.warn("[HAIVA][RUNTIME-PROBE]", message);
  };

  const verify = () => {
    if (window.HAIVA) {
      window.__HAIVA_RUNTIME__.appCreated = true;
      console.log("[HAIVA][RUNTIME-PROBE] window.HAIVA created.");
    } else if (!window.__HAIVA_RUNTIME__.lastError) {
      record("window.HAIVA was not created after startup handoff.");
      window.dispatchEvent(new CustomEvent("haiva:boot-failure", {
        detail: {
          stage: "APP_INSTANCE_NOT_CREATED",
          message: "H.A.I.V.A. application instance was not created."
        }
      }));
    }
  };

  // Do not wait for DOMContentLoaded: boot-loader already controls the
  // startup handoff and may intentionally import app.js during the event.
  setTimeout(verify, 0);
})();
