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
    this.isSpeaking = false;
    this.restartTimer = null;
    this.commandTimer = null;
    this.assistant = new HAIVAAssistant();
    this.lastTranscript = "";
    this.wakeBuffer = "";
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
    if (heard && text) heard.textContent = `Heard: ${text}`;
  }

  setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.setState("VOICE UNAVAILABLE");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = CONFIG.voice.recognitionLanguage || "en-US";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 5;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (!this.isSpeaking) this.setState(this.awaitingCommand ? "LISTENING" : "STANDBY");
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
      this.setState("MICROPHONE DENIED");
      return;
    }

    this.voiceActivated = true;
    this.awaitingCommand = false;
    this.lastTranscript = "";
    this.wakeBuffer = "";
    setVoiceButtonActive(true);
    this.setState("STANDBY");
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
    try { this.recognition.stop(); } catch (error) { console.debug("Recognition stop skipped:", error?.message || error); }
    this.isListening = false;
  }

  normalizeForWake(text) {
    return normalizeSpeech(text || "")
      .replace(/[’'`]/g, "")
      .replace(/\b(hey|hi|yi)\s+(?=haiva\b)/g, "yo ")
      .replace(/\b(?:yo|you|yoh)\s+(?:h\s*a\s*i\s*v\s*a|hi\s+va|heyva|aiva|ha\s*iva|hayva)\b/g, "yo haiva")
      .replace(/\b(?:yo|you|yoh)\s+ha\s*iva\b/g, "yo haiva")
      .replace(/\s+/g, " ")
      .trim();
  }

  findWakeWord(text) {
    const normalized = this.normalizeForWake(text);
    return CONFIG.voice.wakeWords.some(word => {
      const wake = this.normalizeForWake(word);
      return normalized === wake || normalized.startsWith(`${wake} `) || normalized.includes(` ${wake} `) || normalized.endsWith(` ${wake}`);
    });
  }

  stripWakeWord(text) {
    let result = this.normalizeForWake(text);
    for (const word of CONFIG.voice.wakeWords) {
      const wake = this.normalizeForWake(word);
      result = result.replace(wake, "").trim();
    }
    result = result.replace(/\b(?:yo|you|yoh)\s+(?:h\s*a\s*i\s*v\s*a|hi\s+va|heyva|aiva|ha\s*iva|hayva)\b/, "").trim();
    return result;
  }

  handleResult(event) {
    let finalText = "";
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) finalText += ` ${text}`;
      else interimText += ` ${text}`;
    }

    const displayText = this.normalizeForWake(`${finalText} ${interimText}`);
    if (displayText) this.showTranscript(displayText);

    if (this.isSpeaking) return;

    // SpeechRecognition can split "Yo" and "H.A.I.V.A." into separate
    // final events. Keep a short rolling buffer so the wake phrase survives
    // those boundaries instead of remaining forever in STANDBY.
    if (!this.awaitingCommand && finalText.trim()) {
      this.wakeBuffer = this.normalizeForWake(`${this.wakeBuffer} ${finalText}`)
        .split(/\s+/)
        .slice(-12)
        .join(" ");

      if (this.findWakeWord(this.wakeBuffer)) {
        const command = this.stripWakeWord(this.wakeBuffer);
        this.wakeBuffer = "";
        this.lastTranscript = "";
        void this.handleWakeWord(command ? `${CONFIG.voice.wakeWords[0]} ${command}` : CONFIG.voice.wakeWords[0]);
        return;
      }

      // Keep listening for the wake phrase. Do not send ordinary speech to AI.
      return;
    }

    if (!this.awaitingCommand || !finalText.trim()) return;

    const transcript = this.normalizeForWake(finalText);
    if (!transcript || transcript === this.lastTranscript) return;
    this.lastTranscript = transcript;
    void this.handleCommand(transcript);
  }

  async handleWakeWord(transcript) {
    this.awaitingCommand = true;
    this.setState("LISTENING");

    const command = this.stripWakeWord(transcript);
    if (!command) {
      this.stopListening();
      this.isSpeaking = true;
      this.setState("SPEAKING");
      try {
        await speak(CONFIG.assistant.defaultGreeting);
      } finally {
        this.isSpeaking = false;
        this.setState("LISTENING");
        this.startCommandTimeout();
        this.scheduleRecognitionRestart();
      }
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
    this.wakeBuffer = "";
    this.stopListening();
    this.setState("THINKING");

    try {
      await this.assistant.respond(text);
    } catch (error) {
      console.error("Assistant response failed:", error);
      this.isSpeaking = true;
      this.setState("SPEAKING");
      try { await speak("Sorry, Master. I could not process that request."); }
      finally { this.isSpeaking = false; }
    }

    this.setState("STANDBY");
    this.scheduleRecognitionRestart();
  }

  startCommandTimeout() {
    this.clearCommandTimeout();
    this.commandTimer = setTimeout(() => {
      this.awaitingCommand = false;
      this.lastTranscript = "";
      this.wakeBuffer = "";
      this.setState("STANDBY");
      this.scheduleRecognitionRestart();
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
