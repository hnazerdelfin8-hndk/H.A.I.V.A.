// =========================================
// H.A.I.V.A. CAPTURE HANDOFF ARBITER
// =========================================
// One microphone owner at a time. V1 and V3 must release before the
// other capture worker can acquire the microphone.

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
  if (owner === nextOwner && !pendingTimer) return startCapture();

  if (owner !== null && owner !== nextOwner) {
    const previousOwner = owner;
    owner = null;
    try { releasePrevious(previousOwner); } catch (_) {}
  }

  const token = ++generation;
  clearPending();
  pendingOwner = nextOwner;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    if (token !== generation || pendingOwner !== nextOwner) return;
    pendingOwner = null;
    owner = nextOwner;
    try { startCapture(); } catch (_) { owner = null; }
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
