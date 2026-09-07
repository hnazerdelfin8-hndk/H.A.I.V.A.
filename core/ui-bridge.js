// =========================================
// H.A.I.V.A. UI / VOICE BRIDGE
// UI remains presentation-only; voice matching lives in the voice layer.
// =========================================

import { CONFIG } from "./config.js";
import { containsWakeWord as matchWakeWord, removeWakeWords } from "./voice/wake-word.js";

export function setUIState(state) {
  const normalized = String(state).toLowerCase();
  if (typeof document === "undefined" || !document.body) return;
  document.body.dataset.haivaState = normalized;
  const status = document.getElementById("haiva-status");
  if (status) status.textContent = state;
}

export function setVoiceButtonActive(active) {
  if (typeof document === "undefined") return;
  const button = document.getElementById("activate-voice");
  if (!button) return;
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
  button.innerHTML = `<span aria-hidden="true">🎙️</span>`;
  button.title = active ? "Voice active — tap to pause" : "Activate voice mode";
}

export function hasNativeVoiceBridge() {
  return typeof window !== "undefined" && !!window.HaivaBridge;
}

export function speak(text) {
  const value = String(text || "").trim();
  if (!value || typeof window === "undefined") return Promise.resolve();

  if (hasNativeVoiceBridge() && typeof window.HaivaBridge.speak === "function") {
    return new Promise(resolve => {
      let settled = false;
      let timeoutId = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        window.removeEventListener("haiva:native-speech-done", finish);
        resolve();
      };
      window.addEventListener("haiva:native-speech-done", finish, { once: true });
      try {
        window.HaivaBridge.speak(value);
        timeoutId = setTimeout(finish, Math.max(8000, value.length * 120));
      } catch (error) {
        console.warn("Native TTS failed:", error);
        finish();
      }
    });
  }

  if (!("speechSynthesis" in window)) return Promise.resolve();
  return new Promise(resolve => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = CONFIG.voice.speechLanguage;
    utterance.rate = CONFIG.voice.speechRate;
    utterance.pitch = CONFIG.voice.speechPitch;
    utterance.volume = CONFIG.voice.speechVolume;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    speechSynthesis.speak(utterance);
  });
}

export function normalizeSpeech(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsWakeWord(text) {
  return matchWakeWord(text, CONFIG.voice.wakeWords);
}

export function removeWakeWord(text) {
  return removeWakeWords(text, CONFIG.voice.wakeWords);
}
