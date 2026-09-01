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
    this.isProcessing = false;
    this.restartTimer = null;
    this.intentionalStop = false;
    this.assistant = new HAIVAAssistant();
    this.lastTranscript = "";
    this.initialize();
  }

  async initialize() {
    try {
      const result = await initializeHAIVA();
      if (!result?.ready) throw new Error("HAIVA initialization failed");
      this.setupRecognition();
      this.setState("READY");
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
      this.intentionalStop = false;
      if (!this.isSpeaking && !this.isProcessing) this.setState("LISTENING");
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
        this.scheduleRecognitionRestart();
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;

      // Chrome/Android can end SpeechRecognition unexpectedly even with
      // continuous=true. Restart only when H.A.I.V.A. is actively listening.
      if (!this.intentionalStop && this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.scheduleRecognitionRestart();
      }
    };
  }

  async activateVoice() {
    if (!this.recognition) return this.setState("VOICE UNAVAILABLE");
    if (this.voiceActivated) {
      this.startListening();
      return;
    }

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
    this.intentionalStop = false;
    this.lastTranscript = "";
    setVoiceButtonActive(true);
    this.setState("LISTENING");
    this.startListening();
  }

  startListening() {
    if (!this.voiceActivated || !this.recognition || this.isListening || this.isSpeaking || this.isProcessing) return;

    this.intentionalStop = false;
    try {
      this.recognition.start();
    } catch (error) {
      // InvalidStateError simply means recognition is already starting/running.
      console.debug("Recognition start skipped:", error?.message || error);
    }
  }

  scheduleRecognitionRestart() {
    if (!this.voiceActivated || this.isSpeaking || this.isProcessing || this.intentionalStop) return;

    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.startListening();
    }, CONFIG.voice.restartDelay || 500);
  }

  stopListening() {
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this.intentionalStop = true;

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
    if (this.isSpeaking || this.isProcessing || !finalText.trim()) return;

    const transcript = normalizeSpeech(finalText);
    if (!transcript || transcript === this.lastTranscript) return;

    this.lastTranscript = transcript;
    void this.handleCommand(transcript);
  }

  async handleCommand(command) {
    const text = String(command || "").trim();
    if (!text || this.isSpeaking || this.isProcessing) return;

    this.lastTranscript = "";
    this.isProcessing = true;
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
    } finally {
      this.isProcessing = false;
    }

    // One activation keeps the voice loop alive:
    // LISTENING -> THINKING -> SPEAKING -> LISTENING.
    if (this.voiceActivated) {
      this.setState("LISTENING");
      this.scheduleRecognitionRestart();
    }
  }
}

const haiva = new HAIVA();
window.HAIVA = haiva;

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("activate-voice");
  if (!button) return console.warn("Activate Voice button not found.");
  button.addEventListener("click", () => void haiva.activateVoice());
});
