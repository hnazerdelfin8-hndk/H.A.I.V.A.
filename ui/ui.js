// =========================================
// H.A.I.V.A. UI Controller
// =========================================

const orb = document.getElementById("orb");
const status = document.getElementById("status");
const transcript = document.getElementById("transcript");
const reply = document.getElementById("reply");
const micButton = document.getElementById("micButton");

let listening = false;
let conversationMode = false;

// -----------------------------------------
// UI State Controller
// -----------------------------------------

export function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}

export function setTranscript(message) {
  if (transcript) {
    transcript.textContent = message;
  }
}

export function setReply(message) {
  if (reply) {
    reply.textContent = message;
  }
}

export function setOrbState(state) {
  if (!orb) return;

  orb.classList.remove(
    "active",
    "thinking",
    "speaking"
  );

  if (state) {
    orb.classList.add(state);
  }
}

// -----------------------------------------
// Conversation State
// -----------------------------------------

export function setConversationMode(active) {
  conversationMode = active;

  if (!micButton) return;

  if (active) {
    micButton.textContent = "⏹️";
    micButton.classList.add("active");
    setStatus("Listening...");
  } else {
    micButton.textContent = "🎙️";
    micButton.classList.remove("active");
    micButton.classList.remove("listening");
    setStatus("Ready");
  }
}

export function setListening(active) {
  listening = active;

  if (!micButton) return;

  if (active) {
    micButton.classList.add("listening");
    setOrbState("active");
    setStatus("Listening...");
  } else {
    micButton.classList.remove("listening");
    setOrbState(null);
  }
}

// -----------------------------------------
// Reset UI
// -----------------------------------------

export function resetUI() {
  setConversationMode(false);

  setListening(false);

  setStatus("Ready");

  setTranscript(
    'Say "Yo HAIVA" to begin.'
  );

  setReply(
    "Standing by."
  );

  setOrbState(null);
}

// -----------------------------------------
// Initial State
// -----------------------------------------

resetUI();

console.log(
  "H.A.I.V.A. UI controller loaded."
);
