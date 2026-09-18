// H.A.I.V.A. Voice Duplex — canonical event contract
// Duplex is the single native-audio authority. Consumers never start/stop
// microphone capture directly.

export const DUPLEX_EVENTS = Object.freeze({
  READY: "haiva:duplex-ready",
  SPEECH_START: "haiva:duplex-speech-start",
  SPEECH_END: "haiva:duplex-speech-end",
  TRANSCRIPT: "haiva:duplex-transcript",
  BARGE_IN: "haiva:duplex-barge-in",
  ERROR: "haiva:duplex-error",
  RELEASED: "haiva:duplex-released"
});

export const DUPLEX_STATES = Object.freeze({
  IDLE: "IDLE",
  CAPTURING: "CAPTURING",
  PLAYING: "PLAYING",
  BARGE_IN: "BARGE_IN",
  ERROR: "ERROR"
});
