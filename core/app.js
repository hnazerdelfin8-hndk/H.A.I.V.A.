// =========================================
// H.A.I.V.A. Application Controller
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

    this.awaitingCommand = false;

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


      this.startListening();


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
      document.querySelector(
        "#haiva-status"
      );


    if (status) {

      status.textContent = state;

    }


    console.log(
      `H.A.I.V.A. STATE: ${state}`
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
        "Speech Recognition is not supported."
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
        "H.A.I.V.A. voice recognition active."
      );

    };


    this.recognition.onresult =
      (event) => {

        this.handleSpeech(event);

      };


    this.recognition.onerror =
      (event) => {

        console.warn(
          "Voice recognition error:",
          event.error
        );


        this.isRecognitionRunning = false;

      };


    this.recognition.onend = () => {

      this.isRecognitionRunning = false;


      if (CONFIG.features.voice) {

        setTimeout(() => {

          this.startListening();

        }, 500);

      }

    };

  }


  // =======================================
  // START LISTENING
  // =======================================

  startListening() {

    if (!this.recognition) {
      return;
    }


    if (this.isRecognitionRunning) {
      return;
    }


    try {

      this.recognition.start();


      this.setState(
        this.awaitingCommand
          ? "LISTENING"
          : "STANDBY"
      );


    } catch (error) {

      console.warn(
        "Unable to start recognition:",
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


    // -------------------------------------
    // Waiting for wake word
    // -------------------------------------

    if (!this.awaitingCommand) {

      if (
        this.detectWakeWord(transcript)
      ) {

        this.activate(transcript);

      }


      return;

    }


    // -------------------------------------
    // Already activated
    // -------------------------------------

    this.processCommand(
      transcript
    );

  }


  // =======================================
  // WAKE WORD DETECTION
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
          wakeWord,
          ""
        );

    }


    command =
      command.trim();


    // -------------------------------------
    // Wake word only
    // -------------------------------------

    if (!command) {

      await this.speak(
        "Yes, Master. I'm listening."
      );


      this.setState(
        "LISTENING"
      );


      return;

    }


    // -------------------------------------
    // Wake word + command
    // -------------------------------------

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
        await executeSkill(command);


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
        "Sorry, Master. I encountered an error."
      );

    }


    this.awaitingCommand = false;


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


        speechSynthesis.speak(
          utterance
        );

      }
    );

  }

}


// =========================================
// START H.A.I.V.A.
// =========================================

window.HAIVA =
  new HAIVA();
