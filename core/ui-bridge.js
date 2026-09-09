// =========================================
// H.A.I.V.A. UI / VOICE BRIDGE
// =========================================

import { CONFIG } from "./config.js";

export function setUIState(state) {
  const normalized = String(state).toLowerCase();
  document.body.dataset.haivaState = normalized;
  const status = document.getElementById("haiva-status");
  if (status) status.textContent = state;
}

export function setVoiceButtonActive(active) {
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

export function stopSpeaking() {
  if (hasNativeVoiceBridge() && typeof window.HaivaBridge.stopSpeaking === "function") {
    try {
      window.HaivaBridge.stopSpeaking();
      return true;
    } catch (error) {
      console.warn("Native TTS stop failed:", error);
    }
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      return true;
    } catch (error) {
      console.warn("Browser TTS stop failed:", error);
    }
  }
  return false;
}

export function speak(text) {
  const value = String(text || "").trim();
  if (!value) return Promise.resolve();

  if (hasNativeVoiceBridge() && typeof window.HaivaBridge.speak === "function") {
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener("haiva:native-speech-done", finish);
        resolve();
      };
      window.addEventListener("haiva:native-speech-done", finish, { once: true });
      try {
        window.HaivaBridge.speak(value);
        setTimeout(finish, Math.max(8000, value.length * 120));
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
    const finish = () => resolve();
    utterance.onend = finish;
    utterance.onerror = finish;
    speechSynthesis.speak(utterance);
  });
}

export function normalizeSpeech(text) {
  return String(text)
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsWakeWord(text) {
  const normalized = normalizeSpeech(text);
  const wakeWords = Array.isArray(CONFIG.voice.wakeWords) ? CONFIG.voice.wakeWords : [];
  return wakeWords.some(wakeWord => normalized.includes(normalizeSpeech(wakeWord)));
}

export function removeWakeWord(text) {
  let result = String(text);
  const wakeWords = Array.isArray(CONFIG.voice.wakeWords) ? CONFIG.voice.wakeWords : [];
  for (const wakeWord of wakeWords) {
    const escaped = normalizeSpeech(wakeWord)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    result = result.replace(new RegExp(escaped, "ig"), " ");
  }
  return normalizeSpeech(result);
}
