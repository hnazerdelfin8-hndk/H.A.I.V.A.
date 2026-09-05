// H.A.I.V.A. DIAGNOSTIC BOOT LOADER
// Diagnostic-only runtime guard. It executes as a dependency before app.js body.
(() => {
  if (window.__HAIVA_BOOT_LOADER__) return;
  window.__HAIVA_BOOT_LOADER__ = true;

  const modules = [
    ["index.html", 8, "document"],
    ["core/boot-loader.js", 15, "boot-loader.js"],
    ["ui/polish.js", 25, "polish.js"],
    ["core/app.js", 45, "app.js"],
    ["core/initializer.js", 60, "initializer.js"],
    ["core/config.js", 65, "config.js"],
    ["core/assistant.js", 70, "assistant.js"],
    ["core/ui-bridge.js", 75, "ui-bridge.js"],
    ["core/voice/speech-to-text.js", 80, "speech-to-text.js"],
    ["core/phase1-controls.js", 88, "phase1-controls.js"],
    ["core/runtime-probe.js", 92, "runtime-probe.js"]
  ];

  const state = {
    failed: false,
    ready: false,
    selfTest: "PENDING",
    bootStarted: false
  };

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"
  }[ch]));

  // Install global diagnostics immediately at module evaluation time so later
  // dependency/app errors are captured even before DOMContentLoaded.
  const showCapturedError = (message, source = "runtime") => {
    if (state.failed) return;
    state.failed = true;
    const root = document.getElementById("haiva-boot-loader");
    if (!root) {
      console.error("[HAIVA][BOOT]", source, message);
      return;
    }
    root.querySelector("#haiva-boot-title").textContent = "CORE ERROR";
    root.querySelector("#haiva-boot-current").textContent = "Boot stopped — actual runtime error captured.";
    const error = root.querySelector("#haiva-boot-error");
    error.hidden = false;
    error.textContent = `SOURCE: ${source}\n\n${String(message)}`;
    document.body.dataset.haivaState = "error";
    console.error("[HAIVA][BOOT]", source, message);
  };

  window.addEventListener("error", event => {
    showCapturedError(
      event?.error?.stack || event?.message || "Unknown JavaScript error",
      event?.filename || "JavaScript runtime"
    );
  });

  window.addEventListener("unhandledrejection", event => {
    showCapturedError(
      event?.reason?.stack || event?.reason?.message || event?.reason || "Unknown promise rejection",
      "Unhandled Promise rejection"
    );
  });

  const resourceLoaded = name => {
    if (name === "index.html") return true;
    return performance.getEntriesByType("resource").some(entry => {
      try {
        return new URL(entry.name, location.href).pathname.endsWith(name);
      } catch {
        return false;
      }
    });
  };

  const ensureOverlay = () => {
    let root = document.getElementById("haiva-boot-loader");
    if (root) return root;
    root = document.createElement("div");
    root.id = "haiva-boot-loader";
    root.innerHTML = `<div class="haiva-boot-card">
      <div class="haiva-boot-brand">H.A.I.V.A.</div>
      <div class="haiva-boot-subtitle">RUNTIME DIAGNOSTIC</div>
      <div class="haiva-boot-title" id="haiva-boot-title">BOOT LOADER SELF-TEST</div>
      <div class="haiva-boot-percent" id="haiva-boot-percent">0%</div>
      <div class="haiva-boot-track"><div id="haiva-boot-bar"></div></div>
      <div class="haiva-boot-current" id="haiva-boot-current">Validating diagnostic runtime…</div>
      <div class="haiva-boot-list" id="haiva-boot-list"></div>
      <div class="haiva-boot-error" id="haiva-boot-error" hidden></div>
    </div>`;
    const style = document.createElement("style");
    style.textContent = `
      #haiva-boot-loader{position:fixed;inset:0;z-index:2147483647;background:radial-gradient(circle at 50% 20%,rgba(44,130,210,.2),transparent 40%),#02050b;color:#f5f9ff;display:grid;place-items:center;padding:22px;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
      .haiva-boot-card{width:min(100%,520px);border:1px solid rgba(72,173,255,.25);border-radius:24px;background:rgba(5,12,23,.94);box-shadow:0 24px 80px rgba(0,0,0,.5);padding:24px}
      .haiva-boot-brand{font-size:22px;font-weight:800;letter-spacing:6px;text-align:center}.haiva-boot-subtitle{text-align:center;font-size:9px;letter-spacing:3px;color:#7d90aa;margin-top:7px}
      .haiva-boot-title{text-align:center;font-size:11px;font-weight:800;letter-spacing:2px;margin-top:28px}.haiva-boot-percent{text-align:center;font-size:32px;font-weight:800;margin:7px 0 12px}
      .haiva-boot-track{height:8px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}.haiva-boot-track>div{height:100%;width:0%;border-radius:99px;background:linear-gradient(90deg,#48adff,#2de4e0);transition:width .25s ease}
      .haiva-boot-current{font-size:10px;color:#9eb2c9;margin:12px 0}.haiva-boot-list{display:grid;gap:5px;max-height:34vh;overflow:auto}.haiva-boot-item{display:flex;gap:8px;align-items:flex-start;font-size:10px;color:#8ea1b8}.haiva-boot-item.ok{color:#9debe6}.haiva-boot-item.active{color:#bcdcff}.haiva-boot-error{margin-top:14px;padding:12px;border:1px solid rgba(255,89,100,.35);border-radius:12px;background:rgba(255,89,100,.07);font-size:10px;line-height:1.5;color:#ffb0b5;white-space:pre-wrap;word-break:break-word}
    `;
    document.head.appendChild(style);
    document.documentElement.appendChild(root);
    return root;
  };

  const render = (percent, current, failed = false) => {
    const root = ensureOverlay();
    const safePercent = Math.max(0, Math.min(100, percent));
    root.querySelector("#haiva-boot-title").textContent = failed
      ? "CORE ERROR"
      : state.ready
        ? "CORE READY"
        : state.selfTest === "PASS"
          ? "INITIALIZING..."
          : "BOOT LOADER SELF-TEST";
    root.querySelector("#haiva-boot-percent").textContent = `${safePercent}%`;
    root.querySelector("#haiva-boot-bar").style.width = `${safePercent}%`;
    root.querySelector("#haiva-boot-current").textContent = current;
    root.querySelector("#haiva-boot-list").innerHTML = modules.map(([name, target]) => {
      const ok = target <= safePercent && !failed;
      const active = !ok && target >= safePercent && !failed;
      return `<div class="haiva-boot-item ${ok ? "ok" : active ? "active" : ""}">${ok ? "✓" : active ? "→" : "○"} ${esc(name)}</div>`;
    }).join("");
    if (failed) document.body.dataset.haivaState = "error";
  };

  const selfTest = () => {
    try {
      if (!document || !document.documentElement) throw new Error("DOM unavailable");
      ensureOverlay();
      const root = document.getElementById("haiva-boot-loader");
      if (!root || !root.querySelector("#haiva-boot-bar")) throw new Error("Diagnostic UI render failed");
      if (typeof render !== "function") throw new Error("Progress renderer unavailable");
      if (typeof resourceLoaded !== "function") throw new Error("Module tracker unavailable");
      if (typeof showCapturedError !== "function") throw new Error("Error capture handler unavailable");
      window.__HAIVA_BOOT_SELF_TEST__ = {
        dom: "PASS",
        diagnosticUI: "PASS",
        progressRenderer: "PASS",
        errorCapture: "PASS",
        moduleTracker: "PASS",
        status: "PASS"
      };
      state.selfTest = "PASS";
      render(5, "BOOT LOADER: PASS — diagnostic runtime validated.");
      return true;
    } catch (error) {
      state.selfTest = "FAIL";
      window.__HAIVA_BOOT_SELF_TEST__ = { status: "FAIL", error: String(error?.stack || error) };
      showCapturedError(error?.stack || error, "boot-loader self-test");
      return false;
    }
  };

  window.__HAIVA_BOOT__ = {
    mark(message, percent) {
      if (!state.failed) render(percent, message);
    },
    error: showCapturedError,
    selfTest,
    ready() {
      if (state.failed) return;
      state.ready = true;
      render(100, "All critical runtime modules initialized.");
      setTimeout(() => document.getElementById("haiva-boot-loader")?.remove(), 650);
    }
  };

  const boot = () => {
    if (state.bootStarted) return;
    state.bootStarted = true;
    if (!selfTest()) return;

    let lastPercent = 5;
    const timer = setInterval(() => {
      if (state.failed || state.ready) {
        clearInterval(timer);
        return;
      }

      const loaded = modules.filter(([, , token]) => token === "document" || resourceLoaded(token));
      const maxLoaded = loaded.reduce((max, item) => Math.max(max, item[1]), 5);
      const next = Math.max(lastPercent, Math.min(96, maxLoaded));
      if (next !== lastPercent) {
        lastPercent = next;
        const current = modules.find(([, target]) => target > next)?.[0] || "Initializing H.A.I.V.A. core…";
        render(next, `Loading ${current}`);
      }

      const app = window.HAIVA;
      if (app?.state === "READY") window.__HAIVA_BOOT__.ready();
      else if (app?.state === "ERROR") showCapturedError("H.A.I.V.A. application entered ERROR state.", "core/app.js");
    }, 120);

    setTimeout(() => {
      if (!state.failed && !state.ready && !window.HAIVA) {
        showCapturedError("H.A.I.V.A. core did not publish window.HAIVA before the boot timeout.", "core/app.js");
      }
    }, 15000);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
