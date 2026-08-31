// =========================================
// H.A.I.V.A. APPLICATION CONTROLLER
// =========================================

import { initializeHAIVA } from "./initializer.js";
import { CONFIG } from "./config.js";
import {
  executeSkill
} from "./skill-manager.js";


console.log("H.A.I.V.A. is starting...");


class HAIVA {

  constructor() {

    this.state = "BOOTING";

    this.recognition = null;

    this.isRecognitionRunning = false;

    this.voiceActivated = false;

    this.awaitingCommand = false;

    this.lastTranscript = "";

    this.init();

  }


  // =======================================
  // INITIALIZATION
  // =======================================

  async init() {

    try {

      const result =
        await initializeHAIVA();


      if (!result?.ready) {

        this.setState("ERROR");

        return;

      }


      console.log(
        "H.A.I.V.A. Core ready."
      );


      this.setupVoice();


      this.setState("STANDBY");


      console.log(
        "Waiting for voice activation."
      );


    } catch (error) {

      console.error(
        "H.A.I.V.A. startup failed:",
        error
      );


      this.setState("ERROR");

    }

  }


  // =======================================
  // STATE
  // =======================================

  setState(state) {

    this.state = state;


    document.body.dataset.haivaState =
      state.toLowerCase();


    const status =
      document.getElementById(
        "haiva-status"
      );


    if (status) {

      status.textContent = state;

    }


    console.log(
      "H.A.I.V.A. STATE:",
      state
    );

  }


  // =======================================
  // VOICE SETUP
  // =======================================

  setupVoice() {

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

      console.error(
        "Speech Recognition is unavailable."
      );


      this.setState(
        "VOICE UNAVAILABLE"
      );


      return;

    }


    this.recognition =
      new SpeechRecognition();


    this.recognition.continuous =
      CONFIG.voice.continuous;


    this.recognition.interimResults =
      CONFIG.voice.interimResults;


    this.recognition.lang =
      CONFIG.voice.language;


    this.recognition.onstart = () => {

      this.isRecognitionRunning = true;


      console.log(
        "Microphone recognition started."
      );


      if (this.voiceActivated) {

        this.setState(
          this.awaitingCommand
            ? "LISTENING"
            : "STANDBY"
        );

      }

    };


    this.recognition.onresult =
      (event) => {

        this.handleSpeech(event);

      };


    this.recognition.onerror =
      (event) => {

        console.warn(
          "Speech recognition error:",
          event.error
        );


        this.isRecognitionRunning =
          false;


        /*
         * Ignore normal no-speech errors.
         */

        if (
          event.error !== "no-speech" &&
          event.error !== "aborted"
        ) {

          this.setState(
            "VOICE ERROR"
          );

        }

      };


    this.recognition.onend = () => {

      this.isRecognitionRunning =
        false;


      console.log(
        "Speech recognition ended."
      );


      /*
       * Restart only after the user
       * has activated voice.
       */

      if (
        this.voiceActivated
      ) {

        setTimeout(() => {

          this.startListening();

        }, 500);

      }

    };

  }


  // =======================================
  // ACTIVATE MICROPHONE
  // =======================================

  activateVoice() {

    if (!this.recognition) {

      this.setState(
        "VOICE UNAVAILABLE"
      );

      return;

    }


    this.voiceActivated = true;

    this.awaitingCommand = false;


    this.setState(
      "STANDBY"
    );


    this.startListening();

  }


  // =======================================
  // START LISTENING
  // =======================================

  startListening() {

    if (!this.recognition) {
      return;
    }


    if (!this.voiceActivated) {
      return;
    }


    if (this.isRecognitionRunning) {
      return;
    }


    try {

      this.recognition.start();

    } catch (error) {

      console.warn(
        "Recognition start failed:",
        error
      );

    }

  }


  // =======================================
  // HANDLE SPEECH
  // =======================================

  handleSpeech(event) {

    let transcript = "";


    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {

      transcript +=
        event.results[i][0].transcript;

    }


    transcript =
      transcript
        .toLowerCase()
        .trim();


    if (!transcript) {
      return;
    }


    console.log(
      "H.A.I.V.A. heard:",
      transcript
    );


    /*
     * Prevent processing the same transcript
     * repeatedly.
     */

    if (
      transcript ===
      this.lastTranscript
    ) {

      return;

    }


    this.lastTranscript =
      transcript;


    // =====================================
    // STANDBY
    // =====================================

    if (!this.awaitingCommand) {

      if (
        this.detectWakeWord(
          transcript
        )
      ) {

        this.activate(
          transcript
        );

      }

      return;

    }


    // =====================================
    // LISTENING
    // =====================================

    this.processCommand(
      transcript
    );

  }


  // =======================================
  // WAKE WORD
  // =======================================

  detectWakeWord(text) {

    const normalized =
      text
        .replace(/[.,!?]/g, "")
        .trim();


    return CONFIG.voice.wakeWords.some(
      wakeWord =>
        normalized.includes(
          wakeWord.toLowerCase()
        )
    );

  }


  // =======================================
  // ACTIVATE H.A.I.V.A.
  // =======================================

  async activate(transcript) {

    console.log(
      "Wake word detected."
    );


    this.awaitingCommand = true;


    this.setState(
      "LISTENING"
    );


    let command =
      transcript;


    for (
      const wakeWord
      of CONFIG.voice.wakeWords
    ) {

      command =
        command.replace(
          wakeWord.toLowerCase(),
          ""
        );

    }


    command =
      command.trim();


    /*
     * If user only said:
     * "Yi, H.A.I.V.A."
     */

    if (!command) {

      await this.speak(
        "Yes, Master. I'm listening."
      );


      this.setState(
        "LISTENING"
      );


      return;

    }


    await this.processCommand(
      command
    );

  }


  // =======================================
  // PROCESS COMMAND
  // =======================================

  async processCommand(command) {

    if (!command) {
      return;
    }


    this.setState(
      "THINKING"
    );


    try {

      const result =
        await executeSkill(
          command
        );


      if (result) {

        await this.speak(
          result
        );

      } else {

        await this.speak(
          `I heard you say ${command}.`
        );

      }

    } catch (error) {

      console.error(
        "Command processing failed:",
        error
      );


      await this.speak(
        "Sorry, Master. Something went wrong."
      );

    }


    this.awaitingCommand =
      false;


    this.lastTranscript =
      "";


    this.setState(
      "STANDBY"
    );

  }


  // =======================================
  // TEXT TO SPEECH
  // =======================================

  speak(text) {

    return new Promise(
      resolve => {

        if (
          !("speechSynthesis" in window)
        ) {

          resolve();

          return;

        }


        this.setState(
          "SPEAKING"
        );


        speechSynthesis.cancel();


        const utterance =
          new SpeechSynthesisUtterance(
            text
          );


        utterance.lang =
          CONFIG.voice.speechLanguage;


        utterance.rate =
          CONFIG.voice.speechRate;


        utterance.pitch =
          CONFIG.voice.speechPitch;


        utterance.volume =
          CONFIG.voice.speechVolume;


        utterance.onend = () => {

          this.setState(
            this.awaitingCommand
              ? "LISTENING"
              : "STANDBY"
          );


          resolve();

        };


        utterance.onerror = () => {

          resolve();

        };


        speechSynthesis.speak(
          utterance
        );

      }
    );

  }

}


// =========================================
// CREATE H.A.I.V.A.
// =========================================

window.HAIVA =
  new HAIVA();


// =========================================
// CONNECT UI BUTTON
// =========================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const button =
      document.getElementById(
        "activate-voice"
      );


    if (!button) {
      return;
    }


    button.addEventListener(
      "click",
      () => {

        console.log(
          "Voice activation button pressed."
        );


        if (
          window.HAIVA
        ) {

          window.HAIVA.activateVoice();

        }

      }
    );

  }
);
