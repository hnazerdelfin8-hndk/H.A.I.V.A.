// =========================================
// H.A.I.V.A. MAIN APPLICATION
// =========================================

import "../ui/polish.js";
import { initializeHAIVA } from "./initializer.js";
import { CONFIG } from "./config.js";
import { HAIVAAssistant } from "./assistant.js";
import { createSpeechRecognition } from "./voice/speech-to-text.js";
import { setUIState, setVoiceButtonActive, speak, normalizeSpeech, removeWakeWord, hasNativeVoiceBridge } from "./ui-bridge.js";
import { bootCheckpoint } from "./boot-diagnostics.js";

bootCheckpoint("JS_ENTRY_STARTED", "core/app.js module evaluated");

class HAIVA {
  constructor() {
    bootCheckpoint("HAIVA_CONSTRUCTOR_STARTED");
    this.state = "BOOTING";
    this.recognition = null;
    this.nativeVoice = hasNativeVoiceBridge();
    this.nativeVoiceReady = false;
    this.voiceActivated = false;
    this.isListening = false;
    this.isSpeaking = false;
    this.isProcessing = false;
    this.intentionalStop = false;
    this.assistant = new HAIVAAssistant();
    this.lastTranscript = "";
    this.voiceStartTimer = null;
    this.voiceSilenceTimer = null;
    this.voiceHasStarted = false;
    this.pendingVoiceResult = "";
    this.voiceTiming = CONFIG.voice.timing;

    this.setupChat();
    this.setupSettings();
    this.setupNativeVoiceEvents();
    this.setupReminderNotifications();
    this.setState("BOOTING");
    void this.initialize();
  }

  async initialize() {
    bootCheckpoint("INITIALIZER_STARTED");
    this.setState("BOOTING");
    this.setBootMessage("Initializing H.A.I.V.A. core…");
    try {
      const result = await initializeHAIVA();
      if (!result?.ready) throw new Error("HAIVA initialization failed");
      bootCheckpoint("INITIALIZER_READY", result.degraded ? "degraded" : "normal");
      this.setupRecognition();
      bootCheckpoint("UI_BRIDGE_READY");
      this.setState("READY");
      bootCheckpoint("RUNTIME_READY");
      this.setBootMessage("H.A.I.V.A. core is online. Ready, Master.");
      this.showResponse("Core initialized successfully. H.A.I.V.A. is online and ready, Master.");
      void this.checkAIConnection();
    } catch (error) {
      bootCheckpoint("INITIALIZER_FAILED", error?.message || error);
      console.error("Initialization failed:", error);
      this.setupRecognition();
      bootCheckpoint("UI_BRIDGE_READY", "recovery path");
      this.setState("READY");
      bootCheckpoint("RUNTIME_READY", "recovered from initialization failure");
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
    if (!form || !input) return;
    const submit = event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || this.isProcessing) return;
      input.value = "";
      void this.handleTextCommand(text);
    };
    form.addEventListener("submit", submit);
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

  clearVoiceTimers() {
    if (this.voiceStartTimer) clearTimeout(this.voiceStartTimer);
    if (this.voiceSilenceTimer) clearTimeout(this.voiceSilenceTimer);
    this.voiceStartTimer = null;
    this.voiceSilenceTimer = null;
  }

  beginVoiceCycle(armInitialGrace = true) {
    this.clearVoiceTimers();
    this.voiceHasStarted = false;
    this.pendingVoiceResult = "";
    if (!armInitialGrace) return;
    this.voiceStartTimer = setTimeout(() => {
      if (!this.voiceActivated || this.voiceHasStarted || this.isProcessing || this.isSpeaking) return;
      this.stopListening();
      this.voiceActivated = false;
      setVoiceButtonActive(false);
      this.setState("READY");
    }, this.voiceTiming.initialSpeechGraceMs);
  }

  markSpeechStarted() {
    this.voiceHasStarted = true;
    if (this.voiceStartTimer) clearTimeout(this.voiceStartTimer);
    this.voiceStartTimer = null;
    if (this.voiceSilenceTimer) clearTimeout(this.voiceSilenceTimer);
    this.voiceSilenceTimer = null;
  }

  scheduleBrowserSilenceCompletion() {
    if (!this.voiceHasStarted || this.nativeVoice || !this.voiceActivated) return;
    if (this.voiceSilenceTimer) clearTimeout(this.voiceSilenceTimer);
    this.voiceSilenceTimer = setTimeout(() => {
      this.voiceSilenceTimer = null;
      if (!this.voiceActivated || this.isProcessing || this.isSpeaking) return;
      this.stopListening();
      if (this.pendingVoiceResult) {
        const result = this.pendingVoiceResult;
        this.pendingVoiceResult = "";
        void this.handleResultText(result);
      }
    }, this.voiceTiming.postSpeechSilenceMs);
  }

  setupNativeVoiceEvents() {
    if (!this.nativeVoice) return;
    window.addEventListener("haiva:native-voice-ready", () => {
      this.nativeVoiceReady = true;
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.beginVoiceCycle(true);
        this.isListening = true;
        this.setState("LISTENING");
      }
    });
    window.addEventListener("haiva:native-voice-begin", () => {
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.markSpeechStarted();
        this.isListening = true;
        this.setState("LISTENING");
      }
    });
    window.addEventListener("haiva:native-voice-end", () => {
      if (!this.voiceActivated || this.isSpeaking || this.isProcessing) return;
      this.isListening = false;
      this.setState("LISTENING");
    });
    window.addEventListener("haiva:native-voice-partial", event => {
      const text = event.detail?.text?.trim();
      if (text && this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.markSpeechStarted();
        this.showTranscript(normalizeSpeech(text));
      }
    });
    window.addEventListener("haiva:native-voice-result", event => {
      const text = event.detail?.text?.trim();
      if (!text || this.isSpeaking || this.isProcessing || !this.voiceActivated) return;
      this.isListening = false;
      this.pendingVoiceResult = "";
      void this.handleResultText(text);
    });
    window.addEventListener("haiva:native-voice-timeout", () => {
      if (!this.voiceActivated || this.isSpeaking || this.isProcessing) return;
      this.clearVoiceTimers();
      this.isListening = false;
      this.voiceActivated = false;
      this.voiceHasStarted = false;
      this.nativeVoiceReady = false;
      setVoiceButtonActive(false);
      this.setState("READY");
    });
    window.addEventListener("haiva:native-voice-error", event => {
      this.clearVoiceTimers();
      this.isListening = false;
      this.nativeVoiceReady = false;
      const code = Number(event.detail?.code);
      console.warn("[HAIVA] Native speech recognition error:", code);
      if (this.voiceActivated && !this.isProcessing && !this.isSpeaking) {
        this.voiceActivated = false;
        setVoiceButtonActive(false);
        this.setState("VOICE ERROR");
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
        this.voiceActivated = false;
        setVoiceButtonActive(false);
        this.setState("READY");
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
    else if (state === "READY") heard.textContent = "Ready. Type a message or tap the microphone.";
    else if (state === "MICROPHONE DENIED") heard.textContent = "Microphone access is required for voice mode.";
    else if (state === "VOICE UNAVAILABLE") heard.textContent = "Voice recognition is not available in this browser.";
    else if (state === "VOICE ERROR") heard.textContent = "Voice input needs attention. Tap the microphone to try again.";
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
      if (!this.isSpeaking && !this.isProcessing && this.voiceActivated) this.setState("LISTENING");
    };
    this.recognition.onresult = event => this.handleResult(event);
    this.recognition.onerror = event => {
      this.clearVoiceTimers();
      this.isListening = false;
      console.warn("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.voiceActivated = false;
        setVoiceButtonActive(false);
        this.setState("MICROPHONE DENIED");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        this.voiceActivated = false;
        setVoiceButtonActive(false);
        this.setState("VOICE ERROR");
      }
    };
    this.recognition.onend = () => {
      this.isListening = false;
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing && !this.intentionalStop && !this.voiceHasStarted) {
        this.voiceActivated = false;
        this.clearVoiceTimers();
        setVoiceButtonActive(false);
        this.setState("READY");
      }
    };
  }

  async activateVoice() {
    if (!this.recognition && !this.nativeVoice) return this.setState("VOICE UNAVAILABLE");
    if (this.voiceActivated) return;
    if (!this.nativeVoice) {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
        } else {
          throw new Error("Microphone API unavailable");
        }
      } catch (error) {
        console.error("Microphone permission failed:", error);
        return this.setState("MICROPHONE DENIED");
      }
    }
    this.voiceActivated = true;
    this.intentionalStop = false;
    this.lastTranscript = "";
    setVoiceButtonActive(true);
    this.setState("LISTENING");
    this.startListening();
  }

  deactivateVoice() {
    this.voiceActivated = false;
    this.lastTranscript = "";
    this.clearVoiceTimers();
    this.voiceHasStarted = false;
    this.pendingVoiceResult = "";
    this.nativeVoiceReady = false;
    this.stopListening();
    window.speechSynthesis?.cancel?.();
    this.isSpeaking = false;
    this.isProcessing = false;
    setVoiceButtonActive(false);
    this.setState("READY");
    const heard = document.getElementById("heard");
    if (heard) heard.textContent = "Ready. Type a message or tap the microphone.";
  }

  startListening() {
    if (!this.voiceActivated || this.isListening || this.isSpeaking || this.isProcessing) return;
    this.intentionalStop = false;
    if (this.nativeVoice) {
      this.beginVoiceCycle(false);
      this.isListening = true;
      this.setState("LISTENING");
      try { window.HaivaBridge.startVoiceCapture(); }
      catch (error) {
        this.clearVoiceTimers();
        this.isListening = false;
        this.voiceActivated = false;
        this.nativeVoiceReady = false;
        setVoiceButtonActive(false);
        this.setState("VOICE ERROR");
      }
      return;
    }
    this.beginVoiceCycle(true);
    if (!this.recognition) return;
    try { this.recognition.start(); } catch (error) { console.debug("Recognition start skipped:", error?.message || error); }
  }

  stopListening() {
    this.intentionalStop = true;
    if (this.nativeVoice) {
      try { window.HaivaBridge.stopVoiceCapture(); } catch (error) { console.debug("Native recognition stop skipped:", error?.message || error); }
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch (error) { console.debug("Recognition stop skipped:", error?.message || error); }
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
    if (this.isSpeaking || this.isProcessing) return;
    if (interimText.trim()) {
      this.markSpeechStarted();
      this.pendingVoiceResult = finalText.trim() || interimText.trim();
      this.scheduleBrowserSilenceCompletion();
    }
    if (finalText.trim()) {
      this.markSpeechStarted();
      this.pendingVoiceResult = finalText.trim();
      this.scheduleBrowserSilenceCompletion();
    }
  }

  async handleResultText(rawText) {
    let transcript = normalizeSpeech(rawText);
    if (!transcript || transcript === this.lastTranscript) return;
    transcript = removeWakeWord(transcript) || transcript;
    this.lastTranscript = normalizeSpeech(rawText);
    this.showTranscript(transcript);
    if (!transcript || this.isSpeaking || this.isProcessing) return;
    this.clearVoiceTimers();
    await this.handleCommand(transcript);
  }

  async handleCommand(command) {
    this.isProcessing = true;
    this.isListening = false;
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
      this.voiceActivated = false;
      this.nativeVoiceReady = false;
      this.clearVoiceTimers();
      this.voiceHasStarted = false;
      this.pendingVoiceResult = "";
      setVoiceButtonActive(false);
      this.setState("READY");
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  bootCheckpoint("DOM_CONTENT_LOADED");
  const app = new HAIVA();
  const button = document.getElementById("activate-voice");
  if (button) button.addEventListener("click", () => app.handleButtonClick());
  window.HAIVA = app;
});

HAIVA.prototype.handleButtonClick = function handleButtonClick() {
  void this.activateVoice();
};
