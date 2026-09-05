// =========================================
// H.A.I.V.A. UI Controller
// =========================================
// UI-only state helpers.
// Core behavior remains in core/app.js and core/phase1-controls.js.
// Keep these selectors synchronized with index.html and ui/ui.html.

const get = id => document.getElementById(id);

export function setStatus(message) {
  const status = get("haiva-status");
  if (status) status.textContent = String(message ?? "");
}

export function setTranscript(message) {
  const transcript = get("transcript");
  if (transcript) transcript.textContent = String(message ?? "");
}

export function setReply(message) {
  const reply = get("reply");
  if (reply) reply.textContent = String(message ?? "");
}

export function setHeard(message) {
  const heard = get("heard");
  if (heard) heard.textContent = String(message ?? "");
}

export function setOrbState(state) {
  const orb = get("orb");
  if (!orb) return;

  orb.classList.remove("active", "thinking", "speaking", "listening");

  if (state) {
    orb.classList.add(String(state));
  }
}

export function setConversationMode(active) {
  const button = get("activate-voice");
  if (!button) return;

  const enabled = Boolean(active);
  button.classList.toggle("active", enabled);
  button.setAttribute("aria-pressed", String(enabled));
  button.title = enabled
    ? "Voice active — tap to pause"
    : "Activate voice mode";
}

export function setListening(active) {
  const button = get("activate-voice");
  const enabled = Boolean(active);

  if (button) {
    button.classList.toggle("active", enabled);
    button.classList.toggle("listening", enabled);
    button.setAttribute("aria-pressed", String(enabled));
  }

  setOrbState(enabled ? "active" : null);
}

export function setChatEnabled(enabled) {
  const input = get("chat-input");
  const send = get("send-message");
  const active = Boolean(enabled);

  if (input) input.disabled = !active;
  if (send) send.disabled = !active;
}

export function resetUI() {
  setStatus("Ready");
  setHeard("Initializing H.A.I.V.A. core…");
  setTranscript("—");
  setReply("Standing by, Master.");
  setConversationMode(false);
  setOrbState(null);
}

console.log("H.A.I.V.A. UI controller loaded — synchronized contract.");
