// H.A.I.V.A. DIAGNOSTIC BOOT LOADER
// Runs before app.js body via the ui/polish.js dependency chain.
(() => {
  if (window.__HAIVA_BOOT_LOADER__) return;
  window.__HAIVA_BOOT_LOADER__ = true;

  const modules = [
    ["index.html", 10, "document"],
    ["ui/ui.html", 20, "ui-html"],
    ["ui/ui.css", 25, "ui-css"],
    ["ui/ui.js", 35, "ui-js"],
    ["ui/polish.js", 45, "polish.js"],
    ["core/app.js", 60, "app.js"],
    ["core/phase1-controls.js", 70, "phase1-controls.js"],
    ["core/initializer.js", 78, "initializer.js"],
    ["core/ui-bridge.js", 84, "ui-bridge.js"],
    ["core/assistant.js", 88, "assistant.js"],
    ["core/voice/speech-to-text.js", 92, "speech-to-text.js"]
  ];

  const state = {
    failed: false,
    ready: false,
    current: "Starting diagnostic runtime…"
  };

  const esc = value => String(value ?? "").replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[ch]));

  const resourceLoaded = name => {
    if (name === "index.html") return true;
    return performance.getEntriesByType("resource").some(entry => {
      try { return new URL(entry.name, location.href).pathname.endsWith(name); }
      catch { return false; }
    });
  };

  const ensureOverlay = () => {
    let root = document.getElementById("haiva-boot-loader");
    if (root) return root;
    root = document.createElement("div");
    root.id = "haiva-boot-loader";
    root.innerHTML = `
      <div class="haiva-boot-card">
        <div class="haiva-boot-brand">H.A.I.V.A.</div>
        <div class="haiva-boot-subtitle">RUNTIME DIAGNOSTIC</div>
        <div class="haiva-boot-title" id="haiva-boot-title">INITIALIZING...</div>
        <div class="haiva-boot-percent" id="haiva-boot-percent">0%</div>
        <div class="haiva-boot-track"><div id="haiva-boot-bar"></div></div>
        <div class="haiva-boot-current" id="haiva-boot-current">Starting diagnostic runtime…</div>
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
      .haiva-boot-current{font-size:10px;color:#9eb2c9;margin:12px 0}.haiva-boot-list{display:grid;gap:5px;max-height:34vh;overflow:auto}.haiva-boot-item{display:flex;gap:8px;align-items:flex-start;font-size:10px;color:#8ea1b8}.haiva-boot-item.ok{color:#9debe6}.haiva-boot-item.active{color:#bcdcff}.haiva-boot-item.fail{color:#ff8d95}.haiva-boot-error{margin-top:14px;padding:12px;border:1px solid rgba(255,89,100,.35);border-radius:12px;background:rgba(255,89,100,.07);font-size:10px;line-height:1.5;color:#ffb0b5;white-space:pre-wrap;word-break:break-word}
    `;
    document.head.appendChild(style);
    document.documentElement.appendChild(root);
    return root;
  };

  const render = (percent, current, failed = false) => {
    const root = ensureOverlay();
    const title = root.querySelector("#haiva-boot-title");
    const pct = root.querySelector("#haiva-boot-percent");
    const bar = root.querySelector("#haiva-boot-bar");
    const currentEl = root.querySelector("#haiva-boot-current");
    const list = root.querySelector("#haiva-boot-list");
    if (title) title.textContent = failed ? "CORE ERROR" : state.ready ? "CORE READY" : "INITIALIZING...";
    if (pct) pct.textContent = `${Math.max(0, Math.min(100, percent))}%`;
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if (currentEl) currentEl.textContent = current;
    if (list) {
      list.innerHTML = modules.map(([name, target]) => {
        const ok = target <= percent && !failed;
        const active = !ok && target >= percent && !failed;
        return `<div class="haiva-boot-item ${ok ? "ok" : active ? "active" : ""}">${ok ? "✓" : active ? "→" : "○"} ${esc(name)}</div>`;
      }).join("");
    }
    if (failed) document.body.dataset.haivaState = "error";
  };

  const showError = (message, source = "runtime") => {
    if (state.failed) return;
    state.failed = true;
    const root = ensureOverlay();
    const error = root.querySelector("#haiva-boot-error");
    const title = root.querySelector("#haiva-boot-title");
    if (title) title.textContent = "CORE ERROR";
    if (error) {
      error.hidden = false;
      error.textContent = `SOURCE: ${source}\n\n${String(message)}`;
    }
    const current = root.querySelector("#haiva-boot-current");
    if (current) current.textContent = "Boot stopped — actual runtime error captured.";
    document.body.dataset.haivaState = "error";
    console.error("[HAIVA][BOOT]", source, message);
  };

  window.__HAIVA_BOOT__ = {
    mark(message, percent) { render(percent, message); },
    error: showError,
    ready() {
      if (state.failed) return;
      state.ready = true;
      render(100, "All critical runtime modules initialized.");
      setTimeout(() => document.getElementById("haiva-boot-loader")?.remove(), 650);
    }
  };

  const boot = () => {
    ensureOverlay();
    render(5, "Document loaded. Inspecting runtime modules…");

    window.addEventListener("error", event => {
      const message = event?.error?.stack || event?.message || "Unknown JavaScript error";
      showError(message, event?.filename || "JavaScript runtime");
    });
    window.addEventListener("unhandledrejection", event => {
      const reason = event?.reason?.stack || event?.reason?.message || event?.reason || "Unknown promise rejection";
      showError(reason, "Unhandled Promise rejection");
    });

    let lastPercent = 5;
    const timer = setInterval(() => {
      if (state.failed || state.ready) { clearInterval(timer); return; }
      const loaded = modules.filter(([, , token]) => token === "document" || resourceLoaded(token));
      const maxLoaded = loaded.reduce((max, item) => Math.max(max, item[1]), 5);
      const next = Math.max(lastPercent, Math.min(96, maxLoaded));
      if (next !== lastPercent) {
        lastPercent = next;
        const current = modules.find(([, target, token]) => target > next && token !== "document")?.[0] || "Initializing H.A.I.V.A. core…";
        render(next, `Loading ${current}`);
      }
      const app = window.HAIVA;
      if (app) {
        if (app.state === "READY") window.__HAIVA_BOOT__.ready();
        else if (app.state === "ERROR") showError("H.A.I.V.A. application entered ERROR state.", "core/app.js");
      }
    }, 120);

    setTimeout(() => {
      if (!state.failed && !state.ready && !window.HAIVA) {
        showError("H.A.I.V.A. core did not publish window.HAIVA before the boot timeout.", "core/app.js");
      }
    }, 15000);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
