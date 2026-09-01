// =========================================
// H.A.I.V.A. MAIN APPLICATION
// =========================================

import { initializeHAIVA } from "./initializer.js";
import { CONFIG } from "./config.js";
import { HAIVAAssistant } from "./assistant.js";
import { setUIState, setVoiceButtonActive, speak, normalizeSpeech, containsWakeWord, removeWakeWord } from "./ui-bridge.js";

class HAIVA {
  constructor() {
    this.state = "BOOTING";
    this.recognition = null;
    this.voiceActivated = false;
    this.isListening = false;
    this.awaitingCommand = false;
    this.commandTimer = null;
    this.assistant = new HAIVAAssistant();
    this.lastTranscript = "";
    this.initialize();
  }

  async initialize() {
    try {
      const result = await initializeHAIVA();
      if (!result?.ready) return this.setState("ERROR");
      this.setupRecognition();
      this.setState("STANDBY");
    } catch (error) {
      console.error("Initialization failed:", error);
      this.setState("ERROR");
    }
  }

  setState(state) {
    this.state = state;
    setUIState(state);
  }

  setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return this.setState("VOICE UNAVAILABLE");

    this.recognition = new SpeechRecognition();
    this.recognition.lang = CONFIG.voice.recognitionLanguage;
    this.recognition.continuous = CONFIG.voice.continuous;
    this.recognition.interimResults = CONFIG.voice.interimResults;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.setState(this.awaitingCommand ? "LISTENING" : "STANDBY");
    };

    this.recognition.onresult = event => this.handleResult(event);

    this.recognition.onerror = event => {
      this.isListening = false;
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed") this.setState("MICROPHONE DENIED");
      else if (event.error !== "no-speech") this.setState("VOICE ERROR");
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.voiceActivated) {
        setTimeout(() => this.startListening(), CONFIG.voice.restartDelay);
      }
    };
  }

  async activateVoice() {
    if (!this.recognition) return this.setState("VOICE UNAVAILABLE");

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (error) {
      console.error("Microphone permission failed:", error);
      return this.setState("MICROPHONE DENIED");
    }

    this.voiceActivated = true;
    this.awaitingCommand = false;
    this.lastTranscript = "";
    setVoiceButtonActive(true);
    this.setState("STANDBY");
    await speak("H.A.I.V.A. is ready.");
    this.startListening();
  }

  startListening() {
    if (!this.voiceActivated || !this.recognition || this.isListening) return;
    try { this.recognition.start(); }
    catch (error) { console.warn("Recognition start failed:", error); }
  }

  handleResult(event) {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }

    transcript = normalizeSpeech(transcript);
    if (!transcript || transcript === this.lastTranscript) return;
    this.lastTranscript = transcript;

    if (!this.awaitingCommand) {
      if (containsWakeWord(transcript)) this.handleWakeWord(transcript);
      return;
    }

    this.handleCommand(transcript);
  }

  async handleWakeWord(transcript) {
    this.awaitingCommand = true;
    this.setState("LISTENING");
    const command = removeWakeWord(transcript);

    if (!command) {
      await speak(CONFIG.assistant.defaultGreeting);
      this.setState("LISTENING");
      this.startCommandTimeout();
      return;
    }

    await this.handleCommand(command);
  }

  async handleCommand(command) {
    if (!command) return;
    this.clearCommandTimeout();
    this.awaitingCommand = false;
    this.lastTranscript = "";

    try {
      await this.assistant.respond(command);
    } catch (error) {
      console.error("Assistant response failed:", error);
      await speak("Sorry, Master. I could not process that request.");
    }

    this.setState("STANDBY");
    this.startListening();
  }

  startCommandTimeout() {
    this.clearCommandTimeout();
    this.commandTimer = setTimeout(() => {
      this.awaitingCommand = false;
      this.lastTranscript = "";
      this.setState("STANDBY");
      this.startListening();
    }, 8000);
  }

  clearCommandTimeout() {
    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }
  }
}

const haiva = new HAIVA();
window.HAIVA = haiva;

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("activate-voice");
  if (!button) return console.warn("Activate Voice button not found.");
  button.addEventListener("click", () => haiva.activateVoice());
});
