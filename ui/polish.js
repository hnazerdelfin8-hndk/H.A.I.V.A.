// H.A.I.V.A. visual/UX polish layer.
// Keeps the main shell modular so the UI can be replaced without touching the core engine.

import { V2_EVENTS, dispatchV2Event, installV2VoiceControl } from "../core/voice/interaction/v2/interaction.js";
import { installV3VoiceStopper } from "../core/voice/interaction/v3/stopper.js";

const style = document.createElement("style");
style.textContent = `
  .haiva-live-indicator { display:inline-flex; align-items:center; gap:7px; }
  .haiva-live-indicator::after { content:""; width:5px; height:5px; border-radius:50%; background:currentColor; opacity:.75; animation:haivaBlink 1.8s ease-in-out infinite; }
  .hero { isolation:isolate; }
  .hero::after { content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; box-shadow:inset 0 1px rgba(255,255,255,.035); }
  .orb { transition:transform .35s ease, box-shadow .35s ease, border-color .35s ease; }
  .orb-wrap { contain:layout paint; }
  .wave { transition:opacity .25s ease, transform .25s ease; }
  body[data-haiva-state="standby"] .wave { opacity:.34; }
  body[data-haiva-state="listening"] .wave i { animation-duration:.48s; }
  body[data-haiva-state="thinking"] .wave i { animation-duration:.9s; opacity:.65; }
  body[data-haiva-state="speaking"] .wave i { animation-duration:.35s; }
  body[data-haiva-state="error"] .wave { opacity:.9; }
  .mic { min-width:66px; min-height:66px; -webkit-tap-highlight-color:transparent; }
  .mic:focus-visible, .icon-btn:focus-visible, .nav button:focus-visible { outline:2px solid var(--cyan); outline-offset:3px; }
  .bubble { overflow-wrap:anywhere; }
  .status-pill { user-select:none; }
  @keyframes haivaBlink { 0%,100%{opacity:.3} 50%{opacity:1} }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration:.001ms !important; animation-iteration-count:1 !important; scroll-behavior:auto !important; } }
`;
document.head.appendChild(style);

const transcript = document.getElementById("transcript");
if (transcript && transcript.textContent.includes("Yi, H.A.I.V.A.")) transcript.textContent = transcript.textContent.replace("Yi, H.A.I.V.A.", "Yo, H.A.I.V.A.");
const heard = document.getElementById("heard");
if (heard && heard.textContent.includes("Yi, H.A.I.V.A.")) heard.textContent = heard.textContent.replace("Yi, H.A.I.V.A.", "Yo, H.A.I.V.A.");
const status = document.getElementById("haiva-status");
if (status) status.classList.add("haiva-live-indicator");
const mic = document.getElementById("activate-voice");
if (mic) {
  mic.title = "Start or pause H.A.I.V.A. conversational voice mode";
  mic.setAttribute("aria-label", "Start or pause H.A.I.V.A. conversational voice mode");
}

// V2 owns the command boundary; core/app.js owns the event-driven turn lifecycle.
installV2VoiceControl();
// V3 is installed as a dormant stopper boundary; no existing V2 flow is intercepted.
installV3VoiceStopper();
document.addEventListener("click", event => {
  const button = event.target?.closest?.("#activate-voice");
  if (!button || button.disabled) return;
  const app = window.HAIVA;
  const eventName = app?.voiceActivated ? V2_EVENTS.DEACTIVATE : V2_EVENTS.ACTIVATE;
  queueMicrotask(() => dispatchV2Event(eventName));
});

console.log("[HAIVA] UI polish layer loaded — V2 conversational voice wiring active; V3 stopper dormant.");
