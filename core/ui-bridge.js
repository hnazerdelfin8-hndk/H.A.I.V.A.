// =========================================
// H.A.I.V.A. UI / VOICE BRIDGE
// =========================================

import { CONFIG } from "./config.js";

const dispatchVoiceEvent = (name, detail = {}) => {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
};

let speechGeneration = 0;
let activeNativeSpeechFinish = null;
let ignoredNativeCompletion = false;
let ignoredNativeCompletionTimer = null;

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
  const interruptedGeneration = ++speechGeneration;

  if (activeNativeSpeechFinish) {
    window.removeEventListener("haiva:native-speech-done", activeNativeSpeechFinish);
    activeNativeSpeechFinish = null;
  }
  ignoredNativeCompletion = true;
  if (ignoredNativeCompletionTimer) clearTimeout(ignoredNativeCompletionTimer);
  ignoredNativeCompletionTimer = setTimeout(() => {
    ignoredNativeCompletion = false;
    ignoredNativeCompletionTimer = null;
  }, 1500);

  if (hasNativeVoiceBridge() && typeof window.HaivaBridge.stopSpeaking === "function") {
    try {
      window.HaivaBridge.stopSpeaking();
      dispatchVoiceEvent("haiva:speech-done", { interrupted: true, generation: interruptedGeneration });
      return true;
    } catch (error) {
      console.warn("Native TTS stop failed:", error);
    }
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      dispatchVoiceEvent("haiva:speech-done", { interrupted: true, generation: interruptedGeneration });
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

  const generation = ++speechGeneration;
  ignoredNativeCompletion = false;
  if (ignoredNativeCompletionTimer) {
    clearTimeout(ignoredNativeCompletionTimer);
    ignoredNativeCompletionTimer = null;
  }
  dispatchVoiceEvent("haiva:speech-start", { text: value, generation });

  if (hasNativeVoiceBridge() && typeof window.HaivaBridge.speak === "function") {
    return new Promise(resolve => {
      let settled = false;
      const finish = event => {
        if (settled || generation !== speechGeneration) return;
        if (ignoredNativeCompletion) {
          ignoredNativeCompletion = false;
          if (ignoredNativeCompletionTimer) {
            clearTimeout(ignoredNativeCompletionTimer);
            ignoredNativeCompletionTimer = null;
          }
          return;
        }
        settled = true;
        if (activeNativeSpeechFinish === finish) activeNativeSpeechFinish = null;
        window.removeEventListener("haiva:native-speech-done", finish);
        dispatchVoiceEvent("haiva:speech-done", {
          interrupted: event?.detail?.interrupted === true,
          generation
        });
        resolve();
      };
      activeNativeSpeechFinish = finish;
      window.addEventListener("haiva:native-speech-done", finish);
      try {
        window.HaivaBridge.speak(value);
        setTimeout(() => finish(), Math.max(8000, value.length * 120));
      } catch (error) {
        console.warn("Native TTS failed:", error);
        finish();
      }
    });
  }

  if (!("speechSynthesis" in window)) {
    dispatchVoiceEvent("haiva:speech-done", { interrupted: false, generation });
    return Promise.resolve();
  }
  return new Promise(resolve => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = CONFIG.voice.speechLanguage;
    utterance.rate = CONFIG.voice.speechRate;
    utterance.pitch = CONFIG.voice.speechPitch;
    utterance.volume = CONFIG.voice.speechVolume;
    const finish = () => {
      if (generation !== speechGeneration) return;
      dispatchVoiceEvent("haiva:speech-done", { interrupted: false, generation });
      resolve();
    };
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
