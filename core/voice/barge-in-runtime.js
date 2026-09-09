// =========================================
// H.A.I.V.A. V3 LIVE BARGE-IN RUNTIME
// =========================================
// V3 remains a control layer: it observes TTS-time recognition, interrupts
// the current speech turn, and optionally hands a new instruction back to the
// existing app command path. It does not own V1/V2 lifecycle state.

import { createVoiceInteractionV3 } from "./interaction-v3.js";
import { stopSpeaking } from "../ui-bridge.js";

const SpeechRecognitionCtor = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const controller = createVoiceInteractionV3();
let activeTurn = 0;
let active = false;
let browserRecognizer = null;

function getApp() {
  return typeof window !== "undefined'" ? window.HAIVA : null;
}

function stopCapture() {
  if (typeof window !== "undefined" && window.HaivaBridge?.stopVoiceCapture) {
    try { window.HaivaBridge.stopVoiceCapture(); } catch (_) {}
  }
  if (browserRecognizer) {
    try { browserRecognizer.abort(); } catch (_) {}
    browserRecognizer = null;
  }
}

function startBrowserCapture() {
  if (!SpeechRecognitionCtor || browserRecognizer || !active) return;
  try {
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    browserRecognizer = recognition;

    recognition.onresult = event => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || "";
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      const candidate = (finalText || interimText).trim();
      if (candidate && finalText) handleBargeIn(candidate);
    };
    recognition.onerror = () => {
      if (active) browserRecognizer = null;
    };
    recognition.onend = () => {
      browserRecognizer = null;
    };
    recognition.start();
  } catch (error) {
    browserRecognizer = null;
    console.warn("[HAIVA] V3 barge-in browser capture unavailable:", error?.message || error);
  }
}

function startCapture() {
  if (!active) return;
  const app = getApp();
  if (!app?.isSpeaking) return;

  if (window.HaivaBridge?.startVoiceCapture) {
    try { window.HaivaBridge.startVoiceCapture(); } catch (_) {}
  } else {
    startBrowserCapture();
  }
}

function handleBargeIn(text) {
  if (!active) return;
  const app = getApp();
  if (!app?.isSpeaking) return;

  const result = controller.interrupt(text, activeTurn);
  if (!result.interrupted) return;

  active = false;
  stopCapture();
  stopSpeaking();

  // Let the interrupted speak() promise settle first. This keeps the old
  // async command from racing the new command's state transitions.
  if (result.instruction) {
    const instruction = result.instruction;
    setTimeout(() => {
      const currentApp = getApp();
      if (!currentApp) return;
      currentApp.pendingVoiceResult = false;
      void currentApp.handleTextCommand(instruction, true);
    }, 0);
  }
}

window.addEventListener("haiva:speech-start", () => {
  const app = getApp();
  if (!app?.isSpeaking) return;
  active = true;
  activeTurn = controller.beginTurn();
  startCapture();
});

window.addEventListener("haiva:speech-done", () => {
  active = false;
  stopCapture();
});

window.addEventListener("haiva:native-voice-partial", event => {
  if (!active) return;
  const text = event.detail?.text?.trim();
  if (text) {
    const app = getApp();
    if (app?.isSpeaking) app.showTranscript(text);
  }
});

window.addEventListener("haiva:native-voice-result", event => {
  const text = event.detail?.text?.trim();
  if (text) handleBargeIn(text);
});

console.log("[HAIVA] V3 live barge-in runtime loaded.");
