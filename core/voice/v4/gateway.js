// =========================================
// H.A.I.V.A. V4 VOICE ROUTING GATEWAY
// =========================================
// V4 is routing-only.
// It does NOT capture audio, access the microphone, or own a recognizer.
// V1 and V3 remain the actual capture workers.
// V4 routes capture ownership and voice-domain interrupt control.
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

let voiceInterruptHandler = null;
let v3StopHandler = null;
let voiceOutputStopHandler = null;

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

// V3 -> V4 -> VoiceInteraction/Brain.
// V4 transports the raw interruption candidate only; it does not interpret it.
export function registerVoiceInterruptHandler(handler) {
  voiceInterruptHandler = typeof handler === "function" ? handler : null;
  return () => {
    if (voiceInterruptHandler === handler) voiceInterruptHandler = null;
  };
}

export function routeV3InterruptCandidate(candidate) {
  if (!voiceInterruptHandler) return false;
  return voiceInterruptHandler({
    ...candidate,
    source: candidate?.source || "v3"
  }) !== false;
}

// VoiceInteraction -> V4 -> V3 STOP.
export function registerV3StopHandler(handler) {
  v3StopHandler = typeof handler === "function" ? handler : null;
  return () => {
    if (v3StopHandler === handler) v3StopHandler = null;
  };
}

export function requestV3Stop(reason = "interrupt") {
  if (!v3StopHandler) return false;
  v3StopHandler(reason);
  return true;
}

// VoiceInteraction -> V4 -> TTS STOP.
export function registerVoiceOutputStopHandler(handler) {
  voiceOutputStopHandler = typeof handler === "function" ? handler : null;
  return () => {
    if (voiceOutputStopHandler === handler) voiceOutputStopHandler = null;
  };
}

export function requestVoiceOutputStop(reason = "interrupt") {
  if (!voiceOutputStopHandler) return false;
  voiceOutputStopHandler(reason);
  return true;
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
  registerVoiceCaptureOwner,
  registerVoiceInterruptHandler,
  routeV3InterruptCandidate,
  registerV3StopHandler,
  requestV3Stop,
  registerVoiceOutputStopHandler,
  requestVoiceOutputStop,
  getCaptureRoute
});
