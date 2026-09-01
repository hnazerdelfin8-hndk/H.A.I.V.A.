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
    this.awaitingCommand = false;
    this.commandTimer = null;
    this.assistant = new HAIVAAssistant();
    this.lastTranscript = "";
    this.initialize();
  }

  async initialize() {
    try {
      const result = await initializeHAIVA();
      if (!result?.ready) throw new Error("HAIVA initialization failed");
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
    const heard = document.getElementById("heard");
    if (heard && state === "STANDBY") {
      heard.textContent = 'Waiting for “Yo, H.A.I.V.A.”';
    }
  }

  showTranscript(text) {
    const heard = document.getElementById("heard");
    if (heard) heard.textContent = `Heard: ${text}`;
  }

  setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.setState("VOICE UNAVAILABLE");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = CONFIG.voice.recognitionLanguage;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 5;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.setState(this.awaitingCommand ? "LISTENING" : "STANDBY");
    };

    this.recognition.onresult = event => this.handleResult(event);

    this.recognition.onerror = event => {
      this.isListening = false;
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.setState("MICROPHONE DENIED");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        this.setState("VOICE ERROR");
      }
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
      this.setState("MICROPHONE DENIED");
      return;
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
    try {
      this.recognition.start();
    } catch (error) {
      console.warn("Recognition start failed:", error);
    }
  }

  clean(text) {
    return normalizeSpeech(text || "")
      .replace(/\bhey\s+ha\s*iva\b/g, "yo haiva")
      .replace(/\bhi\s+ha\s*iva\b/g, "yo haiva")
      .replace(/\byi\s+ha\s*iva\b/g, "yo haiva")
      .replace(/\byo\s+h\s*a\s*i\s*v\s*a\b/g, "yo haiva")
      .replace(/\byo\s+hi\s+va\b/g, "yo haiva")
      .replace(/\byo\s+heyva\b/g, "yo haiva")
      .replace(/\byo\s+aiva\b/g, "yo haiva")
      .trim();
  }

  findWakeWord(text) {
    const normalized = this.clean(text);
    const wakeWords = ["yo haiva", "yo, haiva", "yo hi va", "yo heyva", "yo aiva", "hey haiva", "hi haiva", "yi haiva"];
    return wakeWords.find(word => normalized.includes(normalizeSpeech(word))) || null;
  }

  stripWakeWord(text) {
    let normalized = this.clean(text);
    const wakeWords = ["yo haiva", "yo hi va", "yo heyva", "yo aiva", "hey haiva", "hi haiva", "yi haiva"];
    for (const word of wakeWords) {
      normalized = normalized.replace(normalizeSpeech(word), "");
    }
    return normalized.trim();
  }

  handleResult(event) {
    let finalText = "";
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) finalText += ` ${text}`;
      else interimText += ` ${text}`;
    }

    const displayText = this.clean(`${finalText} ${interimText}`);
    if (displayText) this.showTranscript(displayText);

    // Do not send interim speech to the AI. Only final recognition results trigger commands.
    if (!finalText.trim()) return;

    const transcript = this.clean(finalText);
    if (!transcript || transcript === this.lastTranscript) return;
    this.lastTranscript = transcript;

    if (!this.awaitingCommand) {
      const wakeWord = this.findWakeWord(transcript);
      if (wakeWord) {
        void this.handleWakeWord(transcript);
      }
      return;
    }

    void this.handleCommand(transcript);
  }

  async handleWakeWord(transcript) {
    this.awaitingCommand = true;
    this.setState("LISTENING");

    const command = this.stripWakeWord(transcript);
    if (!command) {
      await speak(CONFIG.assistant.defaultGreeting);
      this.setState("LISTENING");
      this.startCommandTimeout();
      return;
    }

    await this.handleCommand(command);
  }

  async handleCommand(command) {
    const text = String(command || "").trim();
    if (!text) return;

    this.clearCommandTimeout();
    this.awaitingCommand = false;
    this.lastTranscript = "";
    this.setState("THINKING");

    try {
      await this.assistant.respond(text);
    } catch (error) {
      console.error("Assistant response failed:", error);
      this.setState("SPEAKING");
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
  button.addEventListener("click", () => void haiva.activateVoice());
});
