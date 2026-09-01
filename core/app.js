// =========================================
// H.A.I.V.A. MAIN APPLICATION
// =========================================

import { initializeHAIVA } from "./initializer.js";
import { CONFIG } from "./config.js";
import { HAIVAAssistant } from "./assistant.js";
import { setUIState, setVoiceButtonActive, speak, normalizeSpeech } from "./ui-bridge.js";

class HAIVA {
  constructor() {
    this.state = "BOOTING";
    this.recognition = null;
    this.voiceActivated = false;
    this.isListening = false;
    this.isSpeaking = false;
    this.restartTimer = null;
    this.assistant = new HAIVAAssistant();
    this.lastTranscript = "";
    this.initialize();
  }

  async initialize() {
    try {
      const result = await initializeHAIVA();
      if (!result?.ready) throw new Error("HAIVA initialization failed");
      this.setupRecognition();
      this.setState("LISTENING");
    } catch (error) {
      console.error("Initialization failed:", error);
      this.setState("ERROR");
    }
  }

  setState(state) {
    this.state = state;
    setUIState(state);
    const heard = document.getElementById("heard");
    if (heard && state === "LISTENING") heard.textContent = "Listening...";
  }

  showTranscript(text) {
    const heard = document.getElementById("heard");
    if (heard && text) heard.textContent = `Heard: ${text}`;
  }

  setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return this.setState("VOICE UNAVAILABLE");

    this.recognition = new SpeechRecognition();
    this.recognition.lang = CONFIG.voice.recognitionLanguage || "en-US";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 5;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (!this.isSpeaking) this.setState("LISTENING");
    };

    this.recognition.onresult = event => this.handleResult(event);

    this.recognition.onerror = event => {
      this.isListening = false;
      console.warn("Speech recognition error:", event.error);

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.voiceActivated = false;
        setVoiceButtonActive(false);
        this.setState("MICROPHONE DENIED");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        this.setState("VOICE ERROR");
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.scheduleRecognitionRestart();
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
    this.lastTranscript = "";
    setVoiceButtonActive(true);
    this.setState("LISTENING");
    this.startListening();
  }

  startListening() {
    if (!this.voiceActivated || !this.recognition || this.isListening || this.isSpeaking) return;
    try {
      this.recognition.start();
    } catch (error) {
      console.debug("Recognition start skipped:", error?.message || error);
    }
  }

  scheduleRecognitionRestart() {
    if (!this.voiceActivated || this.isSpeaking) return;
    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => this.startListening(), CONFIG.voice.restartDelay || 500);
  }

  stopListening() {
    clearTimeout(this.restartTimer);
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch (error) {
      console.debug("Recognition stop skipped:", error?.message || error);
    }
    this.isListening = false;
  }

  handleResult(event) {
    let finalText = "";
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) finalText += ` ${text}`;
      else interimText += ` ${text}`;
    }

    const displayText = normalizeSpeech(`${finalText} ${interimText}`);
    if (displayText) this.showTranscript(displayText);
    if (this.isSpeaking || !finalText.trim()) return;

    const transcript = normalizeSpeech(finalText);
    if (!transcript || transcript === this.lastTranscript) return;

    this.lastTranscript = transcript;
    void this.handleCommand(transcript);
  }

  async handleCommand(command) {
    const text = String(command || "").trim();
    if (!text || this.isSpeaking) return;

    this.lastTranscript = "";
    this.stopListening();
    this.setState("THINKING");

    try {
      await this.assistant.respond(text);
    } catch (error) {
      console.error("Assistant response failed:", error);
      this.isSpeaking = true;
      this.setState("SPEAKING");
      try {
        await speak("Sorry, Master. I could not process that request.");
      } finally {
        this.isSpeaking = false;
      }
    }

    this.setState("LISTENING");
    this.scheduleRecognitionRestart();
  }
}

const haiva = new HAIVA();
window.HAIVA = haiva;

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("activate-voice");
  if (!button) return console.warn("Activate Voice button not found.");
  button.addEventListener("click", () => void haiva.activateVoice());
});
