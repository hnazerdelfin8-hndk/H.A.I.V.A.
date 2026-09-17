// H.A.I.V.A. Boot Loader
// Owns only the isolated boot presentation. core/boot.js remains the
// single startup authority for the boot chain.

function bootCheckpoint(stage, message) {
  try {
    void import("./boot-diagnostics.js").then(module => {
      module.bootCheckpoint(stage, message);
    }).catch(() => console.info("[HAIVA-BOOT]", stage, message || ""));
  } catch (_) {
    console.info("[HAIVA-BOOT]", stage, message || "");
  }
}

let finished = false;
let loadingOverlay = null;

const BOOT_STYLE = `
#haiva-boot-screen{
  position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;
  overflow:hidden;background:#020806;color:#d8ffe9;
  font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
.haiva-boot-content{
  position:relative;width:100%;height:100%;display:grid;place-items:center;
}
.socket{
  position:relative;width:min(90vw,420px);height:min(90vw,420px);
  transform:scale(.95);filter:drop-shadow(0 0 24px rgba(40,255,130,.22));
}
.gel{position:absolute;width:72px;height:72px;animation:haivaGelFloat 5s ease-in-out infinite}
.center-gel{left:50%;top:50%;transform:translate(-50%,-50%) scale(1.18);z-index:3}
.c1{left:13%;top:20%}.c2{left:37%;top:11%}.c3{right:13%;top:20%}
.c4{left:13%;bottom:20%}.c5{left:37%;bottom:11%}.c6{right:13%;bottom:20%}
.r1{animation-delay:-1.1s}.c2{animation-delay:-2s}.c3{animation-delay:-3s}.c4{animation-delay:-1.8s}.c5{animation-delay:-2.8s}.c6{animation-delay:-4s}
.hex-brick{
  position:absolute;width:42px;height:24px;left:15px;top:24px;
  clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);
  background:linear-gradient(135deg,rgba(70,255,155,.86),rgba(4,125,64,.38));
  border:1px solid rgba(180,255,215,.25);box-shadow:0 0 14px rgba(55,255,145,.32);
  animation:haivaBrickPulse 2.7s ease-in-out infinite;
}
.h2{left:0;top:0;transform:rotate(60deg)}
.h3{left:30px;top:0;transform:rotate(-60deg)}
.h2,.h3{opacity:.72;animation-delay:-.8s}
.haiva-boot-percent{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;
  font-size:clamp(34px,8vw,54px);font-weight:700;font-variant-numeric:tabular-nums;
  text-shadow:0 0 20px rgba(100,255,170,.75);pointer-events:none;
}
.haiva-boot-loading{
  position:absolute;left:50%;top:calc(50% + min(45vw,210px));transform:translateX(-50%);
  font-size:12px;font-weight:700;letter-spacing:.42em;padding-left:.42em;opacity:.85;
}
.haiva-boot-dots{letter-spacing:.15em}
.haiva-boot-error{
  position:absolute;left:24px;right:24px;bottom:22px;padding:12px;border-radius:12px;
  background:rgba(255,60,60,.10);border:1px solid rgba(255,90,90,.35);
  white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
}
#haiva-boot-retry{position:absolute;bottom:20px;right:24px;padding:9px 16px;border:0;border-radius:10px;cursor:pointer;font-weight:800}
@keyframes haivaGelFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-7px,0)}}
@keyframes haivaBrickPulse{0%,100%{opacity:.28;filter:brightness(.75)}50%{opacity:1;filter:brightness(1.45)}}
@media (max-height:620px){.socket{transform:scale(.72)}.haiva-boot-loading{top:calc(50% + 34vh)}}
`;

function createLoadingOverlay() {
  const existing = document.getElementById("haiva-boot-screen");
  if (existing) {
    loadingOverlay = existing;
    installVisualLayers(existing);
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "haiva-boot-screen";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="haiva-boot-content">
      <div class="socket">
        <div class="gel center-gel">
          <div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div>
        </div>
        <div class="gel c1 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="gel c2 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="gel c3 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="gel c4 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="gel c5 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="gel c6 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="haiva-boot-percent" id="haiva-boot-percent">0%</div>
      </div>
      <div class="haiva-boot-loading">LOADING<span class="haiva-boot-dots">...</span></div>
      <div class="haiva-boot-error" id="haiva-boot-error" hidden></div>
      <button id="haiva-boot-retry" type="button" hidden>RETRY</button>
    </div>`;
  document.body.appendChild(overlay);
  loadingOverlay = overlay;
  installVisualLayers(overlay);
}

function installVisualLayers(overlay) {
  if (!document.getElementById("haiva-boot-layer-style")) {
    const style = document.createElement("style");
    style.id = "haiva-boot-layer-style";
    style.textContent = BOOT_STYLE;
    document.head.appendChild(style);
  }
}

function setProgress(percent) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  const label = document.getElementById("haiva-boot-percent");
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
  if (error) { error.hidden = false; error.textContent = `ERROR: ${message}\\nSTEP: ${stage}`; }
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
