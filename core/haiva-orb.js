// H.A.I.V.A. Core Orb — visual-only renderer.
// Voice ownership remains in VoiceInteraction/DuplexController.
// This module exposes a small UI contract for lifecycle state + amplitude.

const STATES = new Set(["BOOTING","READY","LISTENING","THINKING","SPEAKING","ERROR","VOICE ERROR","VOICE UNAVAILABLE","MICROPHONE DENIED"]);

const canvas = document.getElementById("haiva-core-canvas");
const stateLabel = document.getElementById("haiva-orb-state");

let ctx = null;
let dpr = 1;
let width = 0;
let height = 0;
let state = "BOOTING";
let targetAmp = 0.12;
let amp = 0.12;
let time = 0;

const PARTICLES = 260;
const pts = [];
const ripples = [];

function seed() {
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < PARTICLES; i++) {
    const y = 1 - (i / (PARTICLES - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = golden * i;
    pts.push({
      x: Math.cos(a) * r,
      y,
      z: Math.sin(a) * r,
      phase: Math.random() * Math.PI * 2,
      jitter: 0.6 + Math.random() * 0.8
    });
  }
}

function resize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, canvas.clientWidth * dpr);
  height = Math.max(1, canvas.clientHeight * dpr);
  canvas.width = width;
  canvas.height = height;
}

function hexPath(cx, cy, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6;
    const x = cx + size * Math.cos(a);
    const y = cy + size * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function stateProfile() {
  switch (state) {
    case "LISTENING": return { amp: 0.72, speed: 1.35, pulse: 1.2, label: "LISTENING" };
    case "THINKING": return { amp: 0.52, speed: 1.9, pulse: 1.05, label: "THINKING" };
    case "SPEAKING": return { amp: 0.9, speed: 2.25, pulse: 1.35, label: "SPEAKING" };
    case "ERROR":
    case "VOICE ERROR":
    case "VOICE UNAVAILABLE":
    case "MICROPHONE DENIED": return { amp: 0.22, speed: 0.55, pulse: 0.55, label: "ERROR" };
    case "READY": return { amp: 0.16, speed: 0.72, pulse: 0.75, label: "READY" };
    default: return { amp: 0.1, speed: 0.5, pulse: 0.65, label: "BOOTING" };
  }
}

function render() {
  if (!ctx) return;
  time += 1;
  const profile = stateProfile();
  amp += (targetAmp - amp) * 0.08;
  const cx = width / 2;
  const cy = height / 2;
  const base = Math.min(width, height) / 2;
  const R = base * 0.66 * (1 + Math.sin(time * 0.035 * profile.speed) * 0.035 * profile.pulse + amp * 0.035);

  ctx.fillStyle = "rgba(3,5,4,0.42)";
  ctx.fillRect(0, 0, width, height);

  // Soft glass/haze field.
  const haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8);
  haze.addColorStop(0, `rgba(0,255,140,${0.11 + amp * 0.13})`);
  haze.addColorStop(0.48, `rgba(0,255,140,${0.035 + amp * 0.045})`);
  haze.addColorStop(1, "rgba(0,255,140,0)");
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.8, 0, Math.PI * 2);
  ctx.fill();

  const rotation = time * 0.008 * profile.speed;
  const tilt = Math.sin(time * 0.003) * 0.28;
  const projected = pts.map(p => {
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    const x = p.x * c - p.z * s;
    const z = p.x * s + p.z * c;
    const tc = Math.cos(tilt);
    const ts = Math.sin(tilt);
    const y = p.y * tc - z * ts;
    const z2 = p.y * ts + z * tc;
    const wave = Math.sin(time * 0.045 * p.jitter + p.phase);
    const pulse = 1 + wave * (0.25 + amp * 0.45);
    const perspective = 420 / (420 - z2 * R * 0.55);
    const size = Math.max(1.2, (5.2 + z2 * 3.6) * pulse * dpr);
    const depth = z2 * 0.5 + 0.5;
    return {
      x: cx + x * R * perspective,
      y: cy + y * R * perspective,
      z: z2,
      size,
      alpha: Math.min(0.25 + depth * 0.68 + Math.max(wave, 0) * 0.12 + amp * 0.12, 0.95)
    };
  }).sort((a, b) => a.z - b.z);

  // Connection field.
  ctx.lineWidth = Math.max(0.35, dpr * 0.5);
  for (let i = 0; i < projected.length; i += 5) {
    const a = projected[i];
    const b = projected[(i + 17) % projected.length];
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 55 * dpr) {
      ctx.strokeStyle = `rgba(0,255,140,${Math.max(0, 0.08 - dist / (55 * dpr) * 0.07)})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // Heartbeat / state ripple.
  const beat = (Math.sin(time * 0.045 * profile.speed) + 1) / 2;
  if (time % Math.max(40, Math.round(140 / profile.speed)) === 0) ripples.push({ r: R * 0.15 });

  for (let i = ripples.length - 1; i >= 0; i--) {
    const ripple = ripples[i];
    ripple.r += (1.8 + amp * 2.4) * dpr;
    const max = R * 1.65;
    if (ripple.r > max) {
      ripples.splice(i, 1);
      continue;
    }
    const fade = 1 - ripple.r / max;
    ctx.strokeStyle = `rgba(0,255,140,${fade * (0.12 + amp * 0.16)})`;
    ctx.lineWidth = Math.max(0.7, dpr);
    ctx.beginPath();
    ctx.arc(cx, cy, ripple.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const p of projected) {
    ctx.shadowColor = "rgba(0,255,140,0.72)";
    ctx.shadowBlur = Math.max(2, dpr * (2 + amp * 5));
    const grad = ctx.createRadialGradient(
      p.x - p.size * 0.35, p.y - p.size * 0.35, 0,
      p.x, p.y, p.size * 1.3
    );
    grad.addColorStop(0, `rgba(210,255,235,${p.alpha})`);
    grad.addColorStop(0.42, `rgba(0,255,140,${p.alpha})`);
    grad.addColorStop(1, `rgba(0,65,38,${p.alpha * 0.55})`);
    ctx.fillStyle = grad;
    hexPath(p.x, p.y, p.size);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  requestAnimationFrame(render);
}

export function setState(nextState) {
  state = STATES.has(nextState) ? nextState : "READY";
  const profile = stateProfile();
  targetAmp = profile.amp;
  if (stateLabel) {
    stateLabel.textContent = profile.label;
    stateLabel.dataset.state = profile.label;
  }
}

export function setAmplitude(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return;
  targetAmp = Math.max(0, Math.min(1, n));
}

export function initHAIVAOrb() {
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  resize();
  seed();
  setState("BOOTING");
  window.addEventListener("resize", resize, { passive: true });
  requestAnimationFrame(render);
}

if (typeof window !== "undefined") {
  window.HAIVAOrb = { init: initHAIVAOrb, setState, setAmplitude };
  initHAIVAOrb();
}
