// H.A.I.V.A. Voice Interaction public entrypoint.
// The implementation remains isolated while the voice stack is migrated
// to the canonical duplex boundary. Keep this file as the single import
// surface for core/app.js and tests.
export { VoiceInteraction, VOICE_INTERACTION_EVENTS } from "./interaction/index.js";
