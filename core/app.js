// =========================================
// H.A.I.V.A. MAIN APPLICATION
// =========================================

import "../ui/polish.js";
import { initializeHAIVA } from "./initializer.js";
import { CONFIG } from "./config.js";
import { HAIVAAssistant } from "./assistant.js";
import { createSpeechRecognition } from "./voice/speech-to-text.js";
import { setUIState, setVoiceButtonActive, speak, normalizeSpeech, containsWakeWord, removeWakeWord, hasNativeVoiceBridge } from "./ui-bridge.js";

class HAIVA {
  constructor() {
    this.state = "BOOTING";
    this.recognition = null;
    this.nativeVoice = hasNativeVoiceBridge();
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

    this.setupChat();
    this.setupSettings();
    this.setupNativeVoiceEvents();
    this.setupReminderNotifications();
    this.setState("BOOTING");
    void this.initialize();
  }

  async initialize() {
    this.setState("BOOTING");
    this.setBootMessage("Initializing H.A.I.V.A. core…");
    try {
      const result = await initializeHAIVA();
      if (!result?.ready) throw new Error("HAIVA initialization failed");
      this.setupRecognition();
      this.setState("READY");
      this.setBootMessage("H.A.I.V.A. core is online. Standing by, Master.");
      this.showResponse("Core initialized successfully. H.A.I.V.A. is online and ready, Master.");
      void this.checkAIConnection();
    } catch (error) {
      console.error("Initialization failed:", error);
      this.setupRecognition();
      this.setState("READY");
      this.setBootMessage("Core recovered. H.A.I.V.A. is ready, Master.");
      this.showResponse("H.A.I.V.A. core recovered successfully. I am ready for your command, Master.");
      void this.checkAIConnection();
    }
  }

  setBootMessage(message) {
    const heard = document.getElementById("heard");
    if (heard && message) heard.textContent = message;
  }

  async checkAIConnection() {
    try {
      const response = await fetch(CONFIG.api.chatEndpoint, { method: "GET", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      const micSetting = document.getElementById("mic-setting");
      if (micSetting) micSetting.textContent = (navigator.mediaDevices?.getUserMedia || this.nativeVoice) ? "Available" : "Unavailable";
      if (!response.ok) console.warn("[HAIVA] AI backend health check returned", response.status);
      else console.log("[HAIVA] AI backend health:", data.configuredBrains || []);
    } catch (error) {
      console.warn("[HAIVA] AI backend health check unavailable:", error?.message || error);
    }
  }

  setupSettings() {
    const toggle = document.getElementById("settings-toggle");
    const panel = document.getElementById("settings-panel");
    if (!toggle || !panel) return;
    toggle.addEventListener("click", () => {
      const open = panel.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  setupChat() {
    const form = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    const send = document.getElementById("send-message");
    if (!form || !input) return;
    const submit = event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || this.isProcessing) return;
      input.value = "";
      void this.handleTextCommand(text);
    };
    form.addEventListener("submit", submit);
    send?.addEventListener("click", event => {
      if (typeof event.preventDefault === "function") event.preventDefault();
      form.requestSubmit?.();
    });
  }

  async handleTextCommand(command) {
    this.isProcessing = true;
    this.stopListening();
    this.showTranscript(command);
    this.setState("THINKING");
    try {
      const response = await this.assistant.respond(command);
      const answer = response || CONFIG.assistant.fallbackResponse;
      this.showResponse(answer);
      this.setState("READY");
    } catch (error) {
      console.error("Text command failed:", error);
      this.showResponse(CONFIG.assistant.fallbackResponse);
      this.setState("ERROR");
    } finally {
      this.isProcessing = false;
      if (this.state === "ERROR") this.setState("READY");
    }
  }

  setupNativeVoiceEvents() {
    if (!this.nativeVoice) return;
    window.addEventListener("haiva:native-voice-ready", () => {
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.isListening = true;
        this.setState(this.awaitingCommand ? "LISTENING" : "STANDBY");
      }
    });
    window.addEventListener("haiva:native-voice-begin", () => {
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.isListening = true;
        this.setState("LISTENING");
      }
    });
    window.addEventListener("haiva:native-voice-partial", event => {
      const text = event.detail?.text?.trim();
      if (text && this.voiceActivated && !this.isSpeaking && !this.isProcessing) this.showTranscript(normalizeSpeech(text));
    });
    window.addEventListener("haiva:native-voice-result", event => {
      const text = event.detail?.text?.trim();
      if (!text || this.isSpeaking || this.isProcessing || !this.voiceActivated) return;
      this.isListening = false;
      this.handleResultText(text);
    });
    window.addEventListener("haiva:native-voice-error", event => {
      this.isListening = false;
      const code = Number(event.detail?.code);
      console.warn("[HAIVA] Native speech recognition error:", code);
      if (this.voiceActivated && !this.isProcessing && !this.isSpeaking) {
        this.setState("VOICE ERROR");
        this.scheduleRecognitionRestart();
      }
    });
  }

  setupReminderNotifications() {
    window.addEventListener("haiva:reminder", async event => {
      const message = event.detail?.message;
      if (!message) return;
      this.stopListening();
      this.isSpeaking = true;
      this.setState("SPEAKING");
      try {
        const response = `Reminder: ${message}.`;
        this.showResponse(response);
        await speak(response);
      } catch (error) { console.warn("Reminder speech failed:", error); }
      finally {
        this.isSpeaking = false;
        this.awaitingCommand = false;
        if (this.voiceActivated && !this.isProcessing) {
          this.setState("STANDBY");
          this.scheduleRecognitionRestart();
        } else if (!this.voiceActivated) this.setState("READY");
      }
    });
  }

  setState(state) {
    this.state = state;
    setUIState(state);
    const heard = document.getElementById("heard");
    if (!heard) return;
    if (state === "BOOTING") heard.textContent = "Initializing H.A.I.V.A. core…";
    else if (state === "LISTENING") heard.textContent = "Listening… speak now.";
    else if (state === "THINKING") heard.textContent = "Analyzing your request…";
    else if (state === "SPEAKING") heard.textContent = "H.A.I.V.A. is responding…";
    else if (state === "STANDBY") heard.textContent = "Standing by. Say: Yo, H.A.I.V.A.";
    else if (state === "READY" && !this.voiceActivated) heard.textContent = "Ready. Type a message or tap the microphone.";
    else if (state === "MICROPHONE DENIED") heard.textContent = "Microphone access is required for voice mode.";
    else if (state === "VOICE UNAVAILABLE") heard.textContent = "Voice recognition is not available in this browser.";
    else if (state === "VOICE ERROR") heard.textContent = "Voice input needs attention. Try the microphone again.";
    else if (state === "ERROR") heard.textContent = "H.A.I.V.A. recovered. Ready for another message.";
  }

  showTranscript(text) {
    const transcript = document.getElementById("transcript");
    if (transcript && text) transcript.textContent = text;
  }

  showResponse(text) {
    const reply = document.getElementById("reply");
    if (reply && text) reply.textContent = text;
    const conversation = document.getElementById("conversation");
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }

  setupRecognition() {
    this.recognition = createSpeechRecognition(CONFIG.voice);
    if (!this.recognition && !this.nativeVoice) return this.setState("VOICE UNAVAILABLE");
    if (!this.recognition) return;
    this.recognition.onstart = () => {
      this.isListening = true;
      this.intentionalStop = false;
      if (!this.isSpeaking && !this.isProcessing) this.setState(this.awaitingCommand ? "LISTENING" : "STANDBY");
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
      if (!this.intentionalStop && this.voiceActivated && !this.isSpeaking && !this.isProcessing) this.scheduleRecognitionRestart();
    };
  }

  async activateVoice() {
    if (!this.recognition && !this.nativeVoice) return this.setState("VOICE UNAVAILABLE");
    if (this.voiceActivated) return this.deactivateVoice();
    try {
      if (this.nativeVoice) {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
          stream?.getTracks().forEach(track => track.stop());
        }
      } else if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } else throw new Error("Microphone API unavailable");
    } catch (error) {
      if (!this.nativeVoice) {
        console.error("Microphone permission failed:", error);
        return this.setState("MICROPHONE DENIED");
      }
      console.warn("Browser microphone permission unavailable; continuing with native Android voice.");
    }
    this.voiceActivated = true;
    this.intentionalStop = false;
    this.awaitingCommand = true;
    this.lastTranscript = "";
    setVoiceButtonActive(true);
    this.setState("LISTENING");
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
    if (!this.voiceActivated || this.isListening || this.isSpeaking || this.isProcessing) return;
    this.intentionalStop = false;
    if (this.nativeVoice) {
      this.isListening = true;
      this.setState(this.awaitingCommand ? "LISTENING" : "STANDBY");
      try { window.HaivaBridge.startVoiceCapture(); }
      catch (error) { this.isListening = false; this.setState("VOICE ERROR"); }
      return;
    }
    if (!this.recognition) return;
    try { this.recognition.start(); } catch (error) { console.debug("Recognition start skipped:", error?.message || error); }
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
    if (this.nativeVoice) {
      try { window.HaivaBridge.stopVoiceCapture(); } catch (error) { console.debug("Native recognition stop skipped:", error?.message || error); }
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch (error) { console.debug("Recognition stop skipped:", error?.message || error); }
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
    this.handleResultText(finalText);
  }

  handleResultText(rawText) {
    const transcript = normalizeSpeech(rawText);
    if (!transcript || transcript === this.lastTranscript) return;
    this.lastTranscript = transcript;
    this.showTranscript(transcript);
    if (!this.awaitingCommand) {
      if (!CONFIG.features.wakeWord || containsWakeWord(transcript)) {
        const commandAfterWake = removeWakeWord(transcript);
        if (commandAfterWake) void this.handleCommand(commandAfterWake);
        else { this.armForCommand(); void this.speakWakeAcknowledgement(); }
      } else {
        this.lastTranscript = "";
        this.setState("STANDBY");
        this.scheduleRecognitionRestart();
      }
      return;
    }
    void this.handleCommand(transcript);
  }

  async speakWakeAcknowledgement() {
    this.isSpeaking = true;
    this.setState("SPEAKING");
    try { await speak(CONFIG.assistant.defaultGreeting); }
    catch (error) { console.warn("Wake acknowledgement failed:", error); }
    finally {
      this.isSpeaking = false;
      if (this.voiceActivated && !this.isProcessing) {
        this.setState("LISTENING");
        this.scheduleRecognitionRestart();
      } else if (!this.voiceActivated) this.setState("READY");
    }
  }

  async handleCommand(command) {
    this.isProcessing = true;
    this.isListening = false;
    clearTimeout(this.commandTimer);
    this.commandTimer = null;
    this.stopListening();
    this.showTranscript(command);
    this.setState("THINKING");
    try {
      const response = await this.assistant.respond(command);
      const answer = response || CONFIG.assistant.fallbackResponse;
      this.showResponse(answer);
      this.isSpeaking = true;
      this.setState("SPEAKING");
      await speak(answer);
    } catch (error) {
      console.error("Command failed:", error);
      this.showResponse(CONFIG.assistant.fallbackResponse);
    } finally {
      this.isSpeaking = false;
      this.isProcessing = false;
      this.awaitingCommand = false;
      if (this.voiceActivated) {
        this.setState("STANDBY");
        this.scheduleRecognitionRestart();
      } else this.setState("READY");
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const app = new HAIVA();
  const button = document.getElementById("activate-voice");
  if (button) button.addEventListener("click", () => app.handleButtonClick());
  window.HAIVA = app;
});

HAIVA.prototype.handleButtonClick = function handleButtonClick() {
  void this.activateVoice();
};
