// =========================================
// H.A.I.V.A. UI / VOICE BRIDGE
// =========================================

import { CONFIG } from "./config.js";


export function setUIState(state) {

  const normalized =
    String(state)
      .toLowerCase();


  document.body.dataset.haivaState =
    normalized;


  const status =
    document.getElementById(
      "haiva-status"
    );


  if (status) {

    status.textContent =
      state;

  }

}


export function setVoiceButtonActive(
  active
) {

  const button =
    document.getElementById(
      "activate-voice"
    );


  if (!button) {
    return;
  }


  button.classList.toggle(
    "active",
    active
  );


  button.textContent =
    active
      ? "🎙️ Voice Active"
      : "🎙️ Activate Voice";

}


export function speak(text) {

  return new Promise(
    resolve => {

      if (
        !("speechSynthesis" in window)
      ) {

        resolve();

        return;

      }


      speechSynthesis.cancel();


      const utterance =
        new SpeechSynthesisUtterance(
          String(text)
        );


      utterance.lang =
        CONFIG.voice.speechLanguage;


      utterance.rate =
        CONFIG.voice.speechRate;


      utterance.pitch =
        CONFIG.voice.speechPitch;


      utterance.volume =
        CONFIG.voice.speechVolume;


      utterance.onend =
        () => resolve();


      utterance.onerror =
        () => resolve();


      speechSynthesis.speak(
        utterance
      );

    }
  );

}


export function normalizeSpeech(
  text
) {

  return String(text)
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();

}


export function containsWakeWord(
  text
) {

  const normalized =
    normalizeSpeech(text);


  return CONFIG.voice.wakeWords.some(
    wakeWord =>
      normalized.includes(
        normalizeSpeech(wakeWord)
      )
  );

}


export function removeWakeWord(
  text
) {

  let result =
    String(text);


  for (
    const wakeWord
    of CONFIG.voice.wakeWords
  ) {

    const pattern =
      new RegExp(
        wakeWord
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "ig"
      );


    result =
      result.replace(
        pattern,
        ""
      );

  }


  return result
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();

}
