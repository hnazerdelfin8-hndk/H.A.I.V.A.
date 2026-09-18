// H.A.I.V.A. ROUTING GATEWAY
// Routing/ownership gateway only. No microphone or recognizer.
import { acquireCapture as routeCapture, releaseCapture as releaseRoutedCapture, registerCaptureOwner, getCaptureOwner } from "./capture-handoff.js";
export const V4_CAPTURE_ROUTES = Object.freeze({ V1: "v1", V3: "v3" });
let voiceInterruptHandler = null;
let v3StopHandler = null;
let voiceOutputStopHandler = null;
let handoffGeneration = 0;
export function registerVoiceCaptureOwner(owner, releaseHandler) { return registerCaptureOwner(owner, releaseHandler); }
function routeCaptureTo(owner, startWorkerCapture) { const generation = ++handoffGeneration; return routeCapture(owner, () => { if (generation !== handoffGeneration) return; startWorkerCapture?.(); }); }
export function handoffToV1(startWorkerCapture) { return routeCaptureTo(V4_CAPTURE_ROUTES.V1, startWorkerCapture); }
export function handoffToV3(startWorkerCapture) { return routeCaptureTo(V4_CAPTURE_ROUTES.V3, startWorkerCapture); }
export function releaseFromV1(stopWorkerCapture) { ++handoffGeneration; return releaseRoutedCapture(V4_CAPTURE_ROUTES.V1, stopWorkerCapture); }
export function releaseFromV3(stopWorkerCapture) { ++handoffGeneration; return releaseRoutedCapture(V4_CAPTURE_ROUTES.V3, stopWorkerCapture); }
export function registerVoiceInterruptHandler(handler) { voiceInterruptHandler = typeof handler === "function" ? handler : null; return () => { if (voiceInterruptHandler === handler) voiceInterruptHandler = null; }; }
export function routeV3InterruptCandidate(candidate) { if (!voiceInterruptHandler) return false; return voiceInterruptHandler({ ...candidate, source: candidate?.source || "v3" }) !== false; }
export function registerV3StopHandler(handler) { v3StopHandler = typeof handler === "function" ? handler : null; return () => { if (v3StopHandler === handler) v3StopHandler = null; }; }
export function requestV3Stop(reason = "interrupt") { if (!v3StopHandler) return false; v3StopHandler(reason); return true; }
export function registerVoiceOutputStopHandler(handler) { voiceOutputStopHandler = typeof handler === "function" ? handler : null; return () => { if (voiceOutputStopHandler === handler) voiceOutputStopHandler = null; }; }
export function requestVoiceOutputStop(reason = "interrupt") { if (!voiceOutputStopHandler) return false; voiceOutputStopHandler(reason); return true; }
export function getCaptureRoute() { return getCaptureOwner(); }
export const VoiceGatewayV4 = Object.freeze({ handoffToV1, handoffToV3, releaseFromV1, releaseFromV3, registerVoiceCaptureOwner, registerVoiceInterruptHandler, routeV3InterruptCandidate, registerV3StopHandler, requestV3Stop, registerVoiceOutputStopHandler, requestVoiceOutputStop, getCaptureRoute });
