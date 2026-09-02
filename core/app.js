// =========================================
// H.A.I.V.A. MAIN APPLICATION
// =========================================

import { initializeHAIVA } from "./initializer.js";
import { CONFIG } from "./config.js";
import { HAIVAAssistant } from "./assistant.js";
import {
  setUIState,
  setVoiceButtonActive,
  speak,
  normalizeSpeech,
  containsWakeWord,
  removeWakeWord
} from "./ui-bridge.js";

class HAIVA {
  constructor() {
    this.state = "BOOTING";
    this.recognition = null;
    this.voiceActivated = false;
    this.isListening = false;
    this.isSpeaking = false;
    this.isProcessing = false;
    this.awaitingCommand = false;
    this.restartTimer = null;
    this.commandTimer = null;
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
      this.setupReminderNotifications();
      this.setState("READY");
    } catch (error) {
      console.error("Initialization failed:", error);
      this.setState("ERROR");
    }
  }

  setupReminderNotifications() {
    window.addEventListener("haiva:reminder", async event => {
      const message = event.detail?.message;
      if (!message) return;

      this.stopListening();
      this.isSpeaking = true;
      this.setState("SPEAKING");

      try {
        await speak(`Reminder: ${message}.`);
      } catch (error) {
        console.warn("Reminder speech failed:", error);
      } finally {
        this.isSpeaking = false;
        this.awaitingCommand = false;
        if (this.voiceActivated && !this.isProcessing) {
          this.setState("STANDBY");
          this.scheduleRecognitionRestart();
        } else if (!this.voiceActivated) {
          this.setState("READY");
        }
      }
    });
  }

  setState(state) {
    this.state = state;
    setUIState(state);

    const heard = document.getElementById("heard");
    if (!heard) return;

    if (state === "STANDBY") heard.textContent = "Say: Yi, H.A.I.V.A.";
    if (state === "LISTENING") heard.textContent = "Listening...";
  }

  showTranscript(text) {
    const heard = document.getElementById("heard");
    if (heard && text) heard.textContent = `Heard: ${text}`;
  }

  showResponse(text) {
    const heard = document.getElementById("heard");
    if (heard && text) heard.textContent = `H.A.I.V.A.: ${text}`;
  }

  setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.setState("VOICE UNAVAILABLE");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = CONFIG.voice.recognitionLanguage || "en-US";
    this.recognition.continuous = CONFIG.voice.continuous !== false;
    this.recognition.interimResults = CONFIG.voice.interimResults !== false;
    this.recognition.maxAlternatives = 5;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.intentionalStop = false;
      if (!this.isSpeaking && !this.isProcessing) {
        this.setState(this.awaitingCommand ? "LISTENING" : "STANDBY");
      }
    };

    this.recognition.onresult = event => this.handleResult(event);

    this.recognition.onerror = event => {
      this.isListening = false;
      console.warn("Speech recognition error:", event.error);

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.voiceActivated = false;
        this.awaitingCommand = false;
        setVoiceButtonActive(false);
        this.setState("MICROPHONE DENIED");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        this.setState("VOICE ERROR");
        this.scheduleRecognitionRestart();
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (!this.intentionalStop && this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.scheduleRecognitionRestart();
      }
    };
  }

  async activateVoice() {
    if (!this.recognition) return this.setState("VOICE UNAVAILABLE");
    if (this.voiceActivated) return this.deactivateVoice();

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
    this.awaitingCommand = false;
    this.lastTranscript = "";
    setVoiceButtonActive(true);
    this.setState("STANDBY");
    this.startListening();
  }

  deactivateVoice() {
    this.voiceActivated = false;
    this.awaitingCommand = false;
    this.lastTranscript = "";
    clearTimeout(this.commandTimer);
    this.commandTimer = null;
    this.stopListening();
    window.speechSynthesis?.cancel?.();
    this.isSpeaking = false;
    this.isProcessing = false;
    setVoiceButtonActive(false);
    this.setState("READY");

    const heard = document.getElementById("heard");
    if (heard) heard.textContent = "Voice paused";
  }

  startListening() {
    if (!this.voiceActivated || !this.recognition || this.isListening || this.isSpeaking || this.isProcessing) return;
    this.intentionalStop = false;
    try {
      this.recognition.start();
    } catch (error) {
      console.debug("Recognition start skipped:", error?.message || error);
    }
  }

  scheduleRecognitionRestart() {
    if (!this.voiceActivated || this.isSpeaking || this.isProcessing) return;

    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.intentionalStop = false;
        this.startListening();
      }
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

  armForCommand() {
    this.awaitingCommand = true;
    clearTimeout(this.commandTimer);
    this.commandTimer = setTimeout(() => {
      if (this.awaitingCommand && !this.isProcessing && !this.isSpeaking) {
        this.awaitingCommand = false;
        this.setState("STANDBY");
      }
    }, 10000);
    this.setState("LISTENING");
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

    if (!this.awaitingCommand) {
      if (!CONFIG.features.wakeWord || containsWakeWord(transcript)) {
        const commandAfterWake = removeWakeWord(transcript);

        if (commandAfterWake) {
          void this.handleCommand(commandAfterWake);
        } else {
          // Wake phrase alone gets an immediate acknowledgement, then listens.
          this.armForCommand();
          this.speakWakeAcknowledgement();
        }
      } else {
        this.lastTranscript = "";
        this.setState("STANDBY");
      }
      return;
    }

    clearTimeout(this.commandTimer);
    this.commandTimer = null;
    this.awaitingCommand = false;
    void this.handleCommand(transcript);
  }

  async speakWakeAcknowledgement() {
    if (this.isSpeaking || this.isProcessing || !this.voiceActivated) return;

    this.isSpeaking = true;
    this.stopListening();
    this.setState("SPEAKING");

    try {
      await speak(CONFIG.assistant.defaultGreeting);
    } finally {
      this.isSpeaking = false;
    }

    if (this.voiceActivated && !this.isProcessing) {
      this.armForCommand();
      this.scheduleRecognitionRestart();
    }
  }

  async handleCommand(command) {
    const text = String(command || "").trim();
    if (!text || this.isSpeaking || this.isProcessing || !this.voiceActivated) return;

    this.lastTranscript = "";
    this.isProcessing = true;
    this.stopListening();
    this.setState("THINKING");

    try {
      const response = await this.assistant.respond(text);
      if (response) this.showResponse(response);
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
      this.awaitingCommand = false;
    }

    if (this.voiceActivated) {
      this.setState("STANDBY");
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
