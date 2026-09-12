import "./runtime-probe.js";

// =========================================
// H.A.I.V.A. PHASE 1 — RUNTIME-SAFE VOICE BOUNDARY
// =========================================
// Phase 1 observes connector capability only. VoiceInteraction owns voice
// outcomes and core/app.js owns application/UI state.

(() => {
  if (window.__HAIVA_PHASE1_CONTROLS__) return;
  window.__HAIVA_PHASE1_CONTROLS__ = true;

  const getApp = () => window.HAIVA || null;
  const setBootCheckpoint = (name, ok, detail = "") => {
    document.body.dataset[`haiva${name}`] = ok ? "ok" : "error";
    console.log(`[HAIVA][BOOT] ${name} ${ok ? "OK" : "ERROR"}${detail ? ` — ${detail}` : ""}`);
  };

  const verifyRuntimeBoundary = () => {
    setBootCheckpoint("BootHtml", true, "DOM available");
    const app = getApp();
    if (!app) {
      console.log("[HAIVA][BOOT] Core instance not visible yet; boot controller continues startup.");
      return;
    }
    setBootCheckpoint("BootCore", true, "window.HAIVA available");
    const connectorAvailable = !!window.HaivaBridge;
    setBootCheckpoint("BootConnector", connectorAvailable, connectorAvailable ? "HaivaBridge available" : "HaivaBridge unavailable");
    if (!connectorAvailable) console.warn("[HAIVA][BOOT] Connector unavailable; browser voice path may still be available.");
  };

  window.addEventListener("haiva:native-voice-unavailable", event => {
    const reason = String(event.detail?.reason || "native_voice_unavailable");
    console.warn("[HAIVA][CONNECTOR] Native voice unavailable:", reason);
    // Capability marker only. Do not mutate app state here; VoiceInteraction is
    // the single voice authority and routes the outcome to core/app.js.
    document.body.dataset.haivaVoiceCapability = "unavailable";
  });

  window.addEventListener("haiva:native-voice-timeout", () => {
    document.body.dataset.haivaVoiceCapability = "timeout";
    console.warn("[HAIVA][CONNECTOR] Native voice watchdog timeout; VoiceInteraction handles recovery.");
  });
  window.addEventListener("haiva:microphone-ready", () => { document.body.dataset.haivaMicrophone = "ready"; });
  window.addEventListener("haiva:native-voice-ready", () => { document.body.dataset.haivaNativeVoice = "ready"; });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(verifyRuntimeBoundary, 0), { once: true });
  } else {
    setTimeout(verifyRuntimeBoundary, 0);
  }
  console.log("[HAIVA] Phase 1 runtime-safe voice boundary installed.");
})();
