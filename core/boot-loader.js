// H.A.I.V.A. Boot Loader
// Owns the isolated boot presentation and hands off to core/boot.js.
// core/boot.js is the single startup authority for the H.A.I.V.A. boot chain.

// Keep the first entrypoint as a classic script. The boot screen is also
// statically present in index.html so it renders before any JS/module work.
function bootCheckpoint(stage, message) {
  try {
    void import("./boot-diagnostics.js").then(module => {
      module.bootCheckpoint(stage, message);
    }).catch(() => {
      console.info("[HAIVA-BOOT]", stage, message || "");
    });
  } catch (_) {
    console.info("[HAIVA-BOOT]", stage, message || "");
  }
}

let finished = false;
let loadingOverlay = null;

function createLoadingOverlay() {
  // index.html owns the first-paint boot screen. Never create a second copy.
  const existing = document.getElementById("haiva-boot-screen");
  if (existing) {
    loadingOverlay = existing;
    return;
  }

  // Defensive fallback for hosts that serve an older/malformed index.html.
  const overlay = document.createElement("div");
  overlay.id = "haiva-boot-screen";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="haiva-boot-card">
      <div class="haiva-boot-hex">
        <div class="haiva-boot-glass">
          <div class="haiva-boot-progress-ring" id="haiva-boot-progress-ring">
            <div class="haiva-boot-progress-core">
              <div class="haiva-boot-percent" id="haiva-boot-percent">0%</div>
            </div>
          </div>
        </div>
      </div>
      <div class="haiva-boot-loading">LOADING<span class="haiva-boot-dots">...</span></div>
      <div class="haiva-boot-error" id="haiva-boot-error" hidden></div>
      <button id="haiva-boot-retry" type="button" hidden>RETRY</button>
    </div>`;

  const style = document.createElement("style");
  style.textContent = `
    #haiva-boot-screen{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;overflow:hidden;padding:24px;background:radial-gradient(circle at 50% 42%,rgba(20,70,150,.22),transparent 34%),radial-gradient(circle at 20% 85%,rgba(75,40,190,.16),transparent 28%),#030712;color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    #haiva-boot-screen:before,#haiva-boot-screen:after{content:"";position:absolute;width:34vw;height:34vw;max-width:420px;max-height:420px;border:1px solid rgba(70,150,255,.09);transform:rotate(30deg);pointer-events:none}
    #haiva-boot-screen:before{top:-18vw;left:-12vw}.#haiva-boot-screen:after{bottom:-18vw;right:-12vw}
    .haiva-boot-card{position:relative;width:min(520px,92vw);min-height:540px;display:grid;place-items:center;padding:28px;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(30,65,120,.06));border:1px solid rgba(130,190,255,.08);border-radius:32px;box-shadow:0 30px 100px rgba(0,0,0,.45);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
    .haiva-boot-hex{position:relative;width:min(78vw,390px);aspect-ratio:1;display:grid;place-items:center;clip-path:polygon(25% 6.7%,75% 6.7%,100% 50%,75% 93.3%,25% 93.3%,0 50%);background:linear-gradient(135deg,rgba(100,190,255,.85),rgba(95,55,255,.72),rgba(30,180,255,.75));filter:drop-shadow(0 0 24px rgba(40,140,255,.28))}
    .haiva-boot-hex:before{content:"";position:absolute;inset:2px;clip-path:inherit;background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(20,35,75,.38) 45%,rgba(60,30,130,.22));}
    .haiva-boot-glass{position:relative;width:92%;height:92%;display:grid;place-items:center;clip-path:inherit;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(8,20,45,.68));border:1px solid rgba(180,220,255,.25);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 0 50px rgba(50,140,255,.08)}
    .haiva-boot-progress-ring{--progress:0%;width:64%;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#16c8ff var(--progress),rgba(95,120,180,.16) var(--progress));box-shadow:0 0 30px rgba(15,180,255,.24),inset 0 0 20px rgba(255,255,255,.05)}
    .haiva-boot-progress-ring:before{content:"";position:absolute;width:calc(64% - 10px);aspect-ratio:1;border-radius:50%;background:#071326;border:1px solid rgba(120,190,255,.15)}
    .haiva-boot-progress-core{position:relative;width:calc(100% - 12px);height:calc(100% - 12px);border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,rgba(16,42,78,.96),rgba(3,10,24,.98) 70%);z-index:1}
    .haiva-boot-percent{font-size:clamp(34px,8vw,54px);font-weight:700;letter-spacing:.02em;font-variant-numeric:tabular-nums;text-shadow:0 0 18px rgba(55,200,255,.65)}
    .haiva-boot-loading{position:absolute;bottom:56px;font-size:12px;font-weight:700;letter-spacing:.48em;padding-left:.48em;opacity:.9;text-shadow:0 0 12px rgba(80,180,255,.55)}
    .haiva-boot-dots{letter-spacing:.15em;opacity:.7}
    .haiva-boot-error{position:absolute;left:24px;right:24px;bottom:22px;padding:12px;border-radius:12px;background:rgba(255,60,60,.1);border:1px solid rgba(255,90,90,.35);white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
    #haiva-boot-retry{position:absolute;bottom:20px;right:24px;padding:9px 16px;border:0;border-radius:10px;cursor:pointer;font-weight:800}
    @media (max-height:620px){.haiva-boot-card{min-height:92vh}.haiva-boot-hex{width:min(58vh,330px)}.haiva-boot-loading{bottom:22px}}
  `;
  overlay.appendChild(style);
  document.body.appendChild(overlay);
  loadingOverlay = overlay;
}

function setProgress(percent, message, step) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  const ring = document.getElementById("haiva-boot-progress-ring");
  const label = document.getElementById("haiva-boot-percent");
  if (ring) ring.style.setProperty("--progress", `${value}%`);
  if (label) label.textContent = `${Math.round(value)}%`;
}

window.haivaBootProgress = setProgress;

function showError(reason, stage = "BOOT_FAILED") {
  if (finished) return;
  finished = true;
  const message = reason?.message || String(reason || "Unknown startup error");
  bootCheckpoint(stage, message);
  console.error("[HAIVA-BOOT]", stage, reason);
  setProgress(0);
  const error = document.getElementById("haiva-boot-error");
  const retry = document.getElementById("haiva-boot-retry");
  if (error) { error.hidden = false; error.textContent = `ERROR: ${message}\nSTEP: ${stage}`; }
  if (retry) { retry.hidden = false; retry.addEventListener("click", () => window.location.reload(), { once: true }); }
}

function finishReady() {
  if (finished || document.body.dataset.haivaState !== "ready") return;
  finished = true;
  setProgress(100);
  bootCheckpoint("BOOT_LOADER_READY", "runtime reached READY; revealing H.A.I.V.A. UI");
  setTimeout(() => { loadingOverlay?.remove(); loadingOverlay = null; }, 450);
}

bootCheckpoint("BOOT_LOADER_STARTED");
createLoadingOverlay();
setProgress(8);
bootCheckpoint("LOADING_UI_READY");

window.addEventListener("haiva:boot-failure", event => showError(event.detail?.message || "H.A.I.V.A. core failed during startup.", event.detail?.stage || "BOOT_FAILED"), true);

const observer = new MutationObserver(() => {
  const state = document.body.dataset.haivaState || "unknown";
  if (state === "ready") finishReady();
});
observer.observe(document.body, { attributes: true, attributeFilter: ["data-haiva-state"] });

async function handoffToBoot() {
  bootCheckpoint("BOOT_LOADER_HANDOFF");
  setProgress(18);
  try {
    await import("./boot.js");
    setProgress(30);
    bootCheckpoint("BOOT_MODULE_LOADED");
  } catch (error) {
    showError(error, "BOOT_MODULE_LOAD_FAILED");
  }
}

void handoffToBoot();
