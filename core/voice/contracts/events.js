export const VOICE_EVENTS = Object.freeze({
  VOICE_STARTED: "VOICE_STARTED",
  VOICE_TRANSCRIPT: "VOICE_TRANSCRIPT",
  VOICE_PROCESSING: "VOICE_PROCESSING",
  VOICE_SPEAKING: "VOICE_SPEAKING",
  VOICE_BARGE_IN: "VOICE_BARGE_IN",
  VOICE_CANCELLED: "VOICE_CANCELLED",
  VOICE_ERROR: "VOICE_ERROR",
  VOICE_RECOVERED: "VOICE_RECOVERED"
});

export function createVoiceEvent(type, {
  sessionId = null,
  turn = null,
  source = "voice",
  timestamp = Date.now(),
  data = null
} = {}) {
  if (!Object.values(VOICE_EVENTS).includes(type)) {
    throw new TypeError(`Unknown voice event type: ${String(type)}`);
  }

  return Object.freeze({
    type,
    sessionId,
    turn,
    source,
    timestamp,
    data
  });
}

export function normalizeVoiceEvent(event) {
  if (!event || typeof event !== "object") return null;
  if (!Object.values(VOICE_EVENTS).includes(event.type)) return null;

  return createVoiceEvent(event.type, {
    sessionId: event.sessionId ?? null,
    turn: event.turn ?? null,
    source: event.source ?? "voice",
    timestamp: Number.isFinite(event.timestamp) ? event.timestamp : Date.now(),
    data: event.data ?? null
  });
}
