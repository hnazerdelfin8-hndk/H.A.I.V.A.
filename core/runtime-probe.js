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

  const verify = () => {
    if (window.HAIVA) {
      window.__HAIVA_RUNTIME__.appCreated = true;
      console.log("[HAIVA][RUNTIME-PROBE] window.HAIVA created.");
    } else {
      console.log("[HAIVA][RUNTIME-PROBE] app instance not visible yet; boot controller remains authoritative.");
    }
  };

  // Observation only. Never declare startup failure from this probe because
  // module evaluation and the DOM lifecycle can complete at different times.
  setTimeout(verify, 100);
})();
