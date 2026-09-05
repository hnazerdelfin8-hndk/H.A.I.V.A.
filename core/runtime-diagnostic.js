// H.A.I.V.A. Android/WebView runtime diagnostics.
// Loaded before the core so startup failures are captured even when app.js aborts.
(() => {
  const startedAt = Date.now();
  const report = (kind, detail) => {
    const payload = { kind, detail: String(detail ?? ""), t: Date.now() - startedAt };
    console.log("[HAIVA-DIAG]", JSON.stringify(payload));
    try {
      window.__HAIVA_DIAGNOSTICS__ = window.__HAIVA_DIAGNOSTICS__ || [];
      window.__HAIVA_DIAGNOSTICS__.push(payload);
    } catch (_) {}
  };

  window.addEventListener("error", event => {
    report("window-error", `${event.message || "unknown"} @ ${event.filename || "inline"}:${event.lineno || 0}:${event.colno || 0}`);
  });

  window.addEventListener("unhandledrejection", event => {
    report("unhandled-rejection", event.reason?.stack || event.reason?.message || event.reason || "unknown");
  });

  window.addEventListener("DOMContentLoaded", () => {
    report("dom-ready", `HAIVA=${!!window.HAIVA}`);
    setTimeout(() => report("core-after-1s", `HAIVA=${!!window.HAIVA}`), 1000);
  }, { once: true });

  window.addEventListener("haiva:core-ready", () => report("core-ready", `HAIVA=${!!window.HAIVA}`));
  report("diagnostic-loaded", `readyState=${document.readyState}`);
})();
