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

export function acquireCapture(nextOwner, startNativeOrBrowser) {
  if (owner === nextOwner && !pendingTimer) {
    return startNativeOrBrowser();
  }

  const token = ++generation;
  clearPending();
  pendingOwner = nextOwner;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    if (token !== generation || pendingOwner !== nextOwner) return;
    pendingOwner = null;
    owner = nextOwner;
    startNativeOrBrowser();
  }, HANDOFF_DELAY_MS);
  return true;
}

export function releaseCapture(currentOwner, stopNativeOrBrowser) {
  if (owner !== currentOwner && pendingOwner !== currentOwner) return false;
  ++generation;
  clearPending();
  if (owner === currentOwner) owner = null;
  stopNativeOrBrowser();
  return true;
}

export function getCaptureOwner() {
  return owner;
}
