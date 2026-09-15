// =========================================
// H.A.I.V.A. CAPTURE HANDOFF ARBITER
// =========================================
// One microphone owner at a time. Every restart releases the current
// recognition session before the next session is allowed to acquire it.

const HANDOFF_DELAY_MS = 180;

let owner = null;
let generation = 0;
let pendingTimer = null;
let pendingOwner = null;

function clearPending() {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  pendingOwner = null;
}

export function acquireCapture(nextOwner, startCapture, releasePrevious) {
  const previousOwner = owner;
  ++generation;
  clearPending();

  if (previousOwner !== null) {
    owner = null;
    try { releasePrevious(previousOwner); } catch (_) {}
  }

  const token = generation;
  pendingOwner = nextOwner;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    if (token !== generation || pendingOwner !== nextOwner) return;
    pendingOwner = null;
    owner = nextOwner;
    try {
      startCapture();
    } catch (_) {
      owner = null;
    }
  }, HANDOFF_DELAY_MS);
  return true;
}

export function releaseCapture(currentOwner, stopCapture) {
  if (owner !== currentOwner && pendingOwner !== currentOwner) return false;
  ++generation;
  clearPending();
  if (owner === currentOwner) owner = null;
  try { stopCapture(); } catch (_) {}
  return true;
}

export function getCaptureOwner() {
  return owner;
}
