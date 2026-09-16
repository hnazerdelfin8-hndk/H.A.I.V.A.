// =========================================
// H.A.I.V.A. V4 VOICE ROUTING GATEWAY
// =========================================
// V4 is routing-only.
// It does NOT capture audio, access the microphone, or own a recognizer.
// V1 and V3 remain the actual capture workers.
// V4 only passes capture handoff requests through the shared arbiter.
// V1 and V3 must never hand control directly to each other.

import {
  acquireCapture as routeCapture,
  releaseCapture as releaseRoutedCapture,
  registerCaptureOwner,
  getCaptureOwner
} from "../capture-handoff.js";

export const V4_CAPTURE_ROUTES = Object.freeze({
  V1: "v1",
  V3: "v3"
});

export function registerVoiceCaptureOwner(owner, releaseHandler) {
  return registerCaptureOwner(owner, releaseHandler);
}

// V4 does not start the microphone. The worker supplies the callback
// that performs its own capture operation after routing is granted.
export function handoffToV1(startWorkerCapture) {
  return routeCapture(V4_CAPTURE_ROUTES.V1, startWorkerCapture);
}

export function handoffToV3(startWorkerCapture) {
  return routeCapture(V4_CAPTURE_ROUTES.V3, startWorkerCapture);
}

// V4 only routes release. The worker supplies its own stop operation.
export function releaseFromV1(stopWorkerCapture) {
  return releaseRoutedCapture(V4_CAPTURE_ROUTES.V1, stopWorkerCapture);
}

export function releaseFromV3(stopWorkerCapture) {
  return releaseRoutedCapture(V4_CAPTURE_ROUTES.V3, stopWorkerCapture);
}

// Diagnostic only: which worker is currently routed through the arbiter.
// This does NOT mean V4 owns the microphone.
export function getCaptureRoute() {
  return getCaptureOwner();
}

export const VoiceGatewayV4 = Object.freeze({
  handoffToV1,
  handoffToV3,
  releaseFromV1,
  releaseFromV3,
  getCaptureRoute,
  registerVoiceCaptureOwner
});
