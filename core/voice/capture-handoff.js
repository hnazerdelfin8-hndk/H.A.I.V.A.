// =========================================
// H.A.I.V.A. CAPTURE HANDOFF ARBITER
// =========================================
// One microphone owner at a time. V1 and V3 register their own release
// operation here; neither capture worker calls the other worker directly.
// Ownership changes are immediate. VoiceInteraction remains responsible for
// deciding when a worker should be active; this module only enforces the
// single-owner handoff.

let owner = null;
const releaseHandlers = new Map();

export function registerCaptureOwner(captureOwner, releaseHandler) {
  releaseHandlers.set(captureOwner, releaseHandler);
  return () => releaseHandlers.delete(captureOwner);
}

export function acquireCapture(nextOwner, startCapture) {
  const previousOwner = owner;

  if (previousOwner !== null && previousOwner !== nextOwner) {
    owner = null;
    try { releaseHandlers.get(previousOwner)?.(); } catch (_) {}
  }

  owner = nextOwner;
  try {
    startCapture();
  } catch (_) {
    owner = null;
    return false;
  }
  return true;
}

export function releaseCapture(currentOwner, stopCapture) {
  if (owner !== currentOwner) return false;
  owner = null;
  try { stopCapture(); } catch (_) {}
  return true;
}

export function getCaptureOwner() {
  return owner;
}
