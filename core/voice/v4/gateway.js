// =========================================
// H.A.I.V.A. V4 VOICE GATEWAY
// =========================================
// V4 is the single microphone/capture handoff gateway.
// V1 and V3 are workers; neither worker may hand control directly to the other.
// VoiceInteraction remains the sole voice-domain orchestrator.

import {
  acquireCapture as acquireGatewayCapture,
  releaseCapture as releaseGatewayCapture,
  registerCaptureOwner,
  getCaptureOwner
} from "../capture-handoff.js";

export const V4_CAPTURE_OWNERS = Object.freeze({
  V1: "v1",
  V3: "v3"
});

export function registerVoiceCaptureOwner(owner, releaseHandler) {
  return registerCaptureOwner(owner, releaseHandler);
}

export function handoffToV1(startCapture) {
  return acquireGatewayCapture(V4_CAPTURE_OWNERS.V1, startCapture);
}

export function handoffToV3(startCapture) {
  return acquireGatewayCapture(V4_CAPTURE_OWNERS.V3, startCapture);
}

export function releaseFromV1(stopCapture) {
  return releaseGatewayCapture(V4_CAPTURE_OWNERS.V1, stopCapture);
}

export function releaseFromV3(stopCapture) {
  return releaseGatewayCapture(V4_CAPTURE_OWNERS.V3, stopCapture);
}

export function getMicOwner() {
  return getCaptureOwner();
}

export const VoiceGatewayV4 = Object.freeze({
  handoffToV1,
  handoffToV3,
  releaseFromV1,
  releaseFromV3,
  getMicOwner,
  registerVoiceCaptureOwner
});
