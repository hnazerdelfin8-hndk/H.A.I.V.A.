let voiceInterruptHandler = null;
let v3StopHandler = null;
let voiceOutputStopHandler = null;

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

export const VoiceGatewayV4 = Object.freeze({
  registerVoiceInterruptHandler,
  routeV3InterruptCandidate,
  registerV3StopHandler,
  requestV3Stop,
  registerVoiceOutputStopHandler,
  requestVoiceOutputStop
});
