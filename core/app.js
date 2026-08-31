// =========================================
// H.A.I.V.A. MAIN APPLICATION
// =========================================

import {
  initializeHAIVA
} from "./initializer.js";

import {
  CONFIG
} from "./config.js";

import {
  HAIVAAssistant
} from "./assistant.js";

import {
  setUIState,
  setVoiceButtonActive,
  speak,
  normalizeSpeech,
  containsWakeWord,
  removeWakeWord
} from "./ui-bridge.js";


console.log(
  "H.A.I.V.A. is starting..."
);


class HAIVA {

  constructor() {

    this.state =
      "BOOTING";

    this.recognition =
      null;

    this.voiceActivated =
      false;

    this.isListening =
      false;

    this.awaitingCommand =
      false;

    this.commandTimer =
      null;

    this.assistant =
      new HAIVAAssistant();

    this.lastTranscript =
      "";

    this.initialize();

  }


  // =======================================
  // INITIALIZE
  // =======================================

  async initialize() {

    try {

      const result =
        await initializeHAIVA();


      if (!result?.ready) {

        this.setState(
          "ERROR"
        );

        return;

      }


      this.setupRecognition();


      this.setState(
        "STANDBY"
      );


      console.log(
        "H.A.I.V.A. is ready."
      );

    } catch (error) {

      console.error(
        "Initialization failed:",
        error
      );


      this.setState(
        "ERROR"
      );

    }

  }


  // =======================================
  // STATE
  // =======================================

  setState(state) {

    this.state =
      state;


    setUIState(
      state
    );


    console.log(
      "H.A.I.V.A. STATE:",
      state
    );

  }


  // =======================================
  // SPEECH RECOGNITION SETUP
  // =======================================

  setupRecognition() {

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

      console.error(
        "Speech Recognition is not available in this browser."
      );


      this.setState(
        "VOICE UNAVAILABLE"
      );


      return;

    }


    this.recognition =
      new SpeechRecognition();


    this.recognition.lang =
      CONFIG.voice.recognitionLanguage;


    this.recognition.continuous =
      CONFIG.voice.continuous;


    this.recognition.interimResults =
      CONFIG.voice.interimResults;


    this.recognition.onstart =
      () => {

        this.isListening =
          true;


        console.log(
          "Microphone listening."
        );


        this.setState(
          this.awaitingCommand
            ? "LISTENING"
            : "STANDBY"
        );

      };


    this.recognition.onresult =
      event => {

        this.handleResult(
          event
        );

      };


    this.recognition.onerror =
      event => {

        console.warn(
          "Speech recognition error:",
          event.error
        );


        this.isListening =
          false;


        if (
          event.error ===
          "not-allowed"
        ) {

          this.setState(
            "MICROPHONE DENIED"
          );

          return;

        }


        if (
          event.error !==
          "no-speech"
        ) {

          this.setState(
            "VOICE ERROR"
          );

        }

      };


    this.recognition.onend =
      () => {

        this.isListening =
          false;


        console.log(
          "Microphone listening ended."
        );


        if (
          this.voiceActivated
        ) {

          setTimeout(
            () => {

              this.startListening();

            },
            CONFIG.voice.restartDelay
          );

        }

      };

  }


  // =======================================
  // USER ACTIVATION
  // =======================================

  async activateVoice() {

    console.log(
      "Voice activation requested."
    );


    if (
      !this.recognition
    ) {

      this.setState(
        "VOICE UNAVAILABLE"
      );

      return;

    }


    /*
     * Microphone permission.
     *
     * The button click provides the
     * required user gesture on Chrome.
     */

    try {

      if (
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
      ) {

        const stream =
          await navigator.mediaDevices
            .getUserMedia({
              audio: true
            });


        stream
          .getTracks()
          .forEach(
            track =>
              track.stop()
          );

      }

    } catch (error) {

      console.error(
        "Microphone permission failed:",
        error
      );


      this.setState(
        "MICROPHONE DENIED"
      );


      return;

    }


    this.voiceActivated =
      true;


    this.awaitingCommand =
      false;


    setVoiceButtonActive(
      true
    );


    this.setState(
      "STANDBY"
    );


    /*
     * Small voice confirmation.
     */

    await speak(
      "H.A.I.V.A. is ready."
    );


    this.setState(
      "STANDBY"
    );


    this.startListening();

  }


  // =======================================
  // START LISTENING
  // =======================================

  startListening() {

    if (
      !this.voiceActivated
    ) {

      return;

    }


    if (
      !this.recognition
    ) {

      return;

    }


    if (
      this.isListening
    ) {

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
  // SPEECH RESULT
  // =======================================

  handleResult(event) {

    let transcript =
      "";


    for (
      let i =
        event.resultIndex;

      i <
        event.results.length;

      i++
    ) {

      transcript +=
        event.results[i][0]
          .transcript;

    }


    transcript =
      normalizeSpeech(
        transcript
      );


    if (!transcript) {

      return;

    }


    console.log(
      "H.A.I.V.A. heard:",
      transcript
    );


    if (
      transcript ===
      this.lastTranscript
    ) {

      return;

    }


    this.lastTranscript =
      transcript;


    // =====================================
    // WAITING FOR WAKE WORD
    // =====================================

    if (
      !this.awaitingCommand
    ) {

      if (
        containsWakeWord(
          transcript
        )
      ) {

        this.handleWakeWord(
          transcript
        );

      }

      return;

    }


    // =====================================
    // COMMAND
    // =====================================

    this.handleCommand(
      transcript
    );

  }


  // =======================================
  // WAKE WORD
  // =======================================

  async handleWakeWord(
    transcript
  ) {

    console.log(
      "Wake word detected."
    );


    this.awaitingCommand =
      true;


    this.setState(
      "LISTENING"
    );


    const command =
      removeWakeWord(
        transcript
      );


    /*
     * Example:
     *
     * "yo haiva"
     *
     * No command yet.
     */

    if (!command) {

      await speak(
        CONFIG.assistant
          .defaultGreeting
      );


      this.setState(
        "LISTENING"
      );


      this.startCommandTimeout();


      return;

    }


    await this.handleCommand(
      command
    );

  }


  // =======================================
  // COMMAND
  // =======================================

  async handleCommand(
    command
  ) {

    if (!command) {

      return;

    }


    this.clearCommandTimeout();


    this.awaitingCommand =
      false;


    this.lastTranscript =
      "";


    await this.assistant.respond(
      command
    );


    this.setState(
      "STANDBY"
    );


    /*
     * Return to wake-word mode.
     */

    this.awaitingCommand =
      false;


    this.startListening();

  }


  // =======================================
  // COMMAND TIMEOUT
  // =======================================

  startCommandTimeout() {

    this.clearCommandTimeout();


    this.commandTimer =
      setTimeout(
        () => {

          this.awaitingCommand =
            false;


          this.setState(
            "STANDBY"
          );


          this.lastTranscript =
            "";


          this.startListening();

        },
        8000
      );

  }


  clearCommandTimeout() {

    if (
      this.commandTimer
    ) {

      clearTimeout(
        this.commandTimer
      );


      this.commandTimer =
        null;

    }

  }

}


// =========================================
// START H.A.I.V.A.
// =========================================

const haiva =
  new HAIVA();


window.HAIVA =
  haiva;


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

      console.warn(
        "Activate Voice button not found."
      );


      return;

    }


    button.addEventListener(
      "click",
      () => {

        haiva.activateVoice();

      }
    );

  }
);
