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
#haiva-boot-screen.haiva-layered-boot{
  position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;
  overflow:hidden;padding:24px;color:#ecfff5;background:#02130b;
  font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  isolation:isolate;
}
#haiva-boot-screen.haiva-layered-boot::before{
  content:"";position:absolute;inset:-25%;z-index:-4;
  background:radial-gradient(circle at 18% 20%,rgba(40,255,130,.34),transparent 30%),
    radial-gradient(circle at 82% 78%,rgba(0,180,95,.28),transparent 34%),
    linear-gradient(135deg,#031c10,#063b20 48%,#01170c);
  background-size:140% 140%;animation:haivaGradient 9s ease-in-out infinite alternate;
}
#haiva-boot-screen.haiva-layered-boot::after{
  content:"";position:absolute;inset:0;z-index:-3;
  background:rgba(3,15,10,.38);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);
}
.haiva-boot-wave{
  position:absolute;inset:-12%;z-index:-2;opacity:.72;pointer-events:none;
  background-image:
    linear-gradient(30deg,rgba(40,255,135,.16) 12%,transparent 12.5%,transparent 87%,rgba(40,255,135,.16) 87.5%,rgba(40,255,135,.16)),
    linear-gradient(150deg,rgba(40,255,135,.16) 12%,transparent 12.5%,transparent 87%,rgba(40,255,135,.16) 87.5%,rgba(40,255,135,.16)),
    linear-gradient(30deg,rgba(40,255,135,.10) 12%,transparent 12.5%,transparent 87%,rgba(40,255,135,.10) 87.5%,rgba(40,255,135,.10)),
    linear-gradient(150deg,rgba(40,255,135,.10) 12%,transparent 12.5%,transparent 87%,rgba(40,255,135,.10) 87.5%,rgba(40,255,135,.10));
  background-position:0 0,0 0,30px 52px,30px 52px;background-size:60px 104px;
  mask-image:linear-gradient(90deg,transparent 0%,#000 12%,#000 88%,transparent 100%);
  -webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 12%,#000 88%,transparent 100%);
  animation:haivaGridDrift 7s linear infinite;
}
.haiva-boot-wave::before{
  content:"";position:absolute;left:-20%;top:42%;width:140%;height:28%;
  background:linear-gradient(90deg,transparent,rgba(80,255,155,.04) 18%,rgba(80,255,155,.65) 48%,rgba(150,255,190,.95) 50%,rgba(80,255,155,.28) 54%,transparent 82%);
  filter:blur(12px);transform:rotate(-5deg) skewY(-4deg);
  animation:haivaPulse 3.4s ease-in-out infinite;
}
.haiva-boot-card{
  position:relative;width:min(520px,92vw);min-height:540px;display:grid;place-items:center;
  padding:28px;border:1px solid rgba(170,255,205,.20);border-radius:32px;
  background:rgba(8,35,22,.28);box-shadow:0 30px 100px rgba(0,0,0,.48),inset 0 1px rgba(255,255,255,.08);
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);overflow:hidden;
}
.haiva-boot-card::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(120deg,rgba(255,255,255,.08),transparent 30%,transparent 70%,rgba(70,255,150,.06));pointer-events:none}
.haiva-boot-socket{
  position:absolute;inset:8%;z-index:0;overflow:hidden;opacity:.70;
  transform:scale(1.18);filter:drop-shadow(0 0 18px rgba(50,255,145,.18));
  pointer-events:none;
}
.haiva-boot-socket .gel{position:absolute;width:72px;height:72px;animation:haivaGelFloat 5s ease-in-out infinite;}
.haiva-boot-socket .center-gel{left:50%;top:50%;transform:translate(-50%,-50%) scale(1.18);z-index:3;}
.haiva-boot-socket .c1{left:13%;top:20%}.haiva-boot-socket .c2{left:37%;top:11%}.haiva-boot-socket .c3{right:13%;top:20%}
.haiva-boot-socket .c4{left:13%;bottom:20%}.haiva-boot-socket .c5{left:37%;bottom:11%}.haiva-boot-socket .c6{right:13%;bottom:20%}
.haiva-boot-socket .r1{animation-delay:-1.1s}.haiva-boot-socket .c2{animation-delay:-2.0s}.haiva-boot-socket .c3{animation-delay:-3.0s}.haiva-boot-socket .c4{animation-delay:-1.8s}.haiva-boot-socket .c5{animation-delay:-2.8s}.haiva-boot-socket .c6{animation-delay:-4s}
.haiva-boot-socket .hex-brick{
  position:absolute;width:42px;height:24px;left:15px;top:24px;
  clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);
  background:linear-gradient(135deg,rgba(70,255,155,.78),rgba(4,125,64,.34));
  border:1px solid rgba(180,255,215,.25);box-shadow:0 0 14px rgba(55,255,145,.32);
  animation:haivaBrickPulse 2.7s ease-in-out infinite;
}
.haiva-boot-socket .h2{left:0;top:0;transform:rotate(60deg)}
.haiva-boot-socket .h3{left:30px;top:0;transform:rotate(-60deg)}
.haiva-boot-socket .h2,.haiva-boot-socket .h3{opacity:.72;animation-delay:-.8s}
.haiva-boot-impulse{
  position:absolute;left:-12%;top:50%;width:124%;height:2px;z-index:4;
  background:linear-gradient(90deg,transparent,rgba(80,255,160,.12) 25%,rgba(165,255,205,.95) 50%,rgba(80,255,160,.12) 75%,transparent);
  box-shadow:0 0 22px rgba(90,255,160,.65);filter:blur(.2px);animation:haivaImpulse 3s ease-in-out infinite;
}
.haiva-boot-hex{position:relative;width:min(76vw,390px);aspect-ratio:1;display:grid;place-items:center;filter:drop-shadow(0 0 30px rgba(40,255,130,.28));z-index:1}
.haiva-boot-hex::before,.haiva-boot-hex::after{content:"";position:absolute;inset:0;clip-path:polygon(25% 6.7%,75% 6.7%,100% 50%,75% 93.3%,25% 93.3%,0 50%)}
.haiva-boot-hex::before{background:linear-gradient(135deg,rgba(80,255,155,.9),rgba(5,120,60,.7));animation:haivaHexGlow 2.6s ease-in-out infinite}
.haiva-boot-hex::after{inset:3px;background:rgba(2,23,13,.66)}
.haiva-boot-glass{position:relative;z-index:1;width:91%;height:91%;display:grid;place-items:center;clip-path:polygon(25% 6.7%,75% 6.7%,100% 50%,75% 93.3%,25% 93.3%,0 50%);background:rgba(4,28,17,.38);border:1px solid rgba(160,255,195,.24);box-shadow:inset 0 0 60px rgba(50,255,140,.08)}
.haiva-boot-progress-ring{position:relative;--progress:0%;width:64%;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:conic-gradient(rgba(110,255,170,1) var(--progress),rgba(100,180,130,.13) var(--progress));box-shadow:0 0 32px rgba(40,255,130,.22);animation:haivaSpinner 2.2s linear infinite}
.haiva-boot-progress-ring::before{content:"";position:absolute;inset:7px;border-radius:50%;background:#03150b;border:1px solid rgba(120,255,170,.20)}
.haiva-boot-progress-core{position:relative;z-index:1;width:calc(100% - 12px);height:calc(100% - 12px);border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,rgba(8,54,30,.96),rgba(2,15,9,.98) 70%)}
.haiva-boot-percent{font-size:clamp(34px,8vw,54px);font-weight:700;letter-spacing:.02em;font-variant-numeric:tabular-nums;text-shadow:0 0 20px rgba(100,255,170,.7)}
.haiva-boot-loading{position:absolute;bottom:56px;font-size:12px;font-weight:700;letter-spacing:.42em;padding-left:.42em;opacity:.92;text-shadow:0 0 14px rgba(80,255,150,.6)}
.haiva-boot-dots{letter-spacing:.15em;opacity:.72}
.haiva-boot-error{position:absolute;left:24px;right:24px;bottom:22px;padding:12px;border-radius:12px;background:rgba(255,60,60,.10);border:1px solid rgba(255,90,90,.35);white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
#haiva-boot-retry{position:absolute;bottom:20px;right:24px;padding:9px 16px;border:0;border-radius:10px;cursor:pointer;font-weight:800}
@keyframes haivaGradient{0%{transform:scale(1) translate3d(-2%,-1%,0);filter:hue-rotate(0deg)}100%{transform:scale(1.08) translate3d(2%,1%,0);filter:hue-rotate(18deg)}}
@keyframes haivaGridDrift{to{background-position:60px 104px,60px 104px,90px 156px,90px 156px}}
@keyframes haivaPulse{0%,100%{transform:translateX(-16%) rotate(-5deg) skewY(-4deg);opacity:.18}50%{transform:translateX(16%) rotate(-5deg) skewY(-4deg);opacity:.95}}
@keyframes haivaSpinner{to{transform:rotate(360deg)}}
@keyframes haivaHexGlow{0%,100%{filter:brightness(.82)}50%{filter:brightness(1.25)}}
@keyframes haivaGelFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-7px,0)}}
@keyframes haivaBrickPulse{0%,100%{opacity:.28;filter:brightness(.75)}50%{opacity:1;filter:brightness(1.45)}}
@keyframes haivaImpulse{0%,100%{transform:translateY(-70px) scaleX(.72);opacity:0}25%{opacity:.25}50%{transform:translateY(0) scaleX(1);opacity:1}75%{opacity:.25}100%{transform:translateY(70px) scaleX(.72)}}
@media (max-height:620px){.haiva-boot-card{min-height:92vh}.haiva-boot-hex{width:min(58vh,330px)}.haiva-boot-loading{bottom:22px}}
`;

function createLoadingOverlay() {
  const existing = document.getElementById("haiva-boot-screen");
  if (existing) {
    loadingOverlay = existing;
    existing.classList.add("haiva-layered-boot");
    installVisualLayers(existing);
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "haiva-boot-screen";
  overlay.className = "haiva-layered-boot";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="haiva-boot-card">
      <div class="haiva-boot-socket" aria-hidden="true">
        <div class="gel center-gel"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="gel c1 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="gel c2 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="gel c3 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="gel c4 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="gel c5 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="gel c6 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
        <div class="haiva-boot-impulse"></div>
      </div>
      <div class="haiva-boot-hex"><div class="haiva-boot-glass">
        <div class="haiva-boot-progress-ring" id="haiva-boot-progress-ring"><div class="haiva-boot-progress-core"><div class="haiva-boot-percent" id="haiva-boot-percent">0%</div></div></div>
      </div></div>
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
  if (!overlay.querySelector(".haiva-boot-wave")) {
    const wave = document.createElement("div");
    wave.className = "haiva-boot-wave";
    wave.setAttribute("aria-hidden", "true");
    overlay.prepend(wave);
  }
  if (!overlay.querySelector(".haiva-boot-socket")) {
    const card = overlay.querySelector(".haiva-boot-card");
    const socket = document.createElement("div");
    socket.className = "haiva-boot-socket";
    socket.setAttribute("aria-hidden", "true");
    socket.innerHTML = `
      <div class="gel center-gel"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
      <div class="gel c1 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
      <div class="gel c2 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
      <div class="gel c3 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
      <div class="gel c4 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
      <div class="gel c5 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
      <div class="gel c6 r1"><div class="hex-brick h1"></div><div class="hex-brick h2"></div><div class="hex-brick h3"></div></div>
      <div class="haiva-boot-impulse"></div>`;
    card?.prepend(socket);
  }
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
observer.observe(document.body, { attributes: true, attributeFilter: ["data-haivaState"] });

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
