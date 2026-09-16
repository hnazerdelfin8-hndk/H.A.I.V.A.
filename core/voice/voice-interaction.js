// =========================================
// H.A.I.V.A. VOICE INTERACTION LEGACY ALIAS
// =========================================
// Canonical Voice Interaction lives at core/voice/interaction.js.
// Keep this file as a compatibility alias so existing imports do not
// create a second coordinator or a second capture authority.

export {
  VoiceInteraction,
  VOICE_INTERACTION_EVENTS
} from "./interaction.js";
