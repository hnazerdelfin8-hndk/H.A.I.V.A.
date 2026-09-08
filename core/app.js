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
    this.voiceRestartTimer = null;
    this.voiceSilenceRetries = 0;
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
      throw error;
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
      void this.handleTextCommand(text, false);
    };
    form.addEventListener("submit", submit);
  }

  async handleTextCommand(command, speakResponse = false) {
    this.isProcessing = true;
    this.stopListening();
    this.showTranscript(command);
    this.setState("THINKING");
    try {
      const response = await this.assistant.respond(command);
      const answer = response || CONFIG.assistant.fallbackResponse;
      this.showResponse(answer);
      if (speakResponse) {
        this.isSpeaking = true;
        this.setState("SPEAKING");
        try { await speak(answer); }
        catch (speechError) { console.warn("Voice response failed:", speechError); }
        finally { this.isSpeaking = false; }
      }
      this.setState("READY");
    } catch (error) {
      console.error("Text command failed:", error);
      this.showResponse(CONFIG.assistant.fallbackResponse);
      this.setState("ERROR");
    } finally {
      this.isProcessing = false;
      this.isSpeaking = false;
      this.cancelVoiceRestart();
      this.voiceSilenceRetries = 0;
      if (this.state === "ERROR") this.setState("READY");
      this.voiceActivated = false;
      this.nativeVoiceReady = false;
      setVoiceButtonActive(false);
    }
  }

  setupNativeVoiceEvents() {
    if (!this.nativeVoice) return;
    window.addEventListener("haiva:native-voice-ready", () => {
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.cancelVoiceRestart();
        this.nativeVoiceReady = true;
        this.isListening = true;
        this.setState("LISTENING");
      }
    });
    window.addEventListener("haiva:native-voice-begin", () => {
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.cancelVoiceRestart();
        this.voiceSilenceRetries = 0;
        this.nativeVoiceReady = true;
        this.isListening = true;
        this.setState("LISTENING");
      }
    });
    window.addEventListener("haiva:native-voice-end", () => {
      if (this.isSpeaking || this.isProcessing || !this.voiceActivated) return;
      this.isListening = false;
      this.nativeVoiceReady = false;
      this.scheduleVoiceRestart();
    });
    window.addEventListener("haiva:native-voice-partial", event => {
      const text = event.detail?.text?.trim();
      if (text && this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.voiceSilenceRetries = 0;
        this.cancelVoiceRestart();
        this.showTranscript(normalizeSpeech(text));
      }
    });
    window.addEventListener("haiva:native-voice-result", event => {
      const text = event.detail?.text?.trim();
      if (!text || this.isSpeaking || this.isProcessing || !this.voiceActivated) return;
      this.cancelVoiceRestart();
      this.voiceSilenceRetries = 0;
      this.isListening = false;
      this.nativeVoiceReady = false;
      void this.handleResultText(text);
    });
    window.addEventListener("haiva:native-voice-timeout", () => {
      if (this.isSpeaking || this.isProcessing) return;
      this.isListening = false;
      this.voiceActivated = false;
      this.nativeVoiceReady = false;
      this.cancelVoiceRestart();
      setVoiceButtonActive(false);
      this.setState("READY");
    });
    window.addEventListener("haiva:native-voice-error", event => {
      this.isListening = false;
      this.nativeVoiceReady = false;
      const code = Number(event.detail?.code);
      console.warn("[HAIVA] Native speech recognition error:", code);
      if (this.isProcessing || this.isSpeaking) return;
      if (code === 6 || code === 7 || code === 1) {
        this.scheduleVoiceRestart();
        return;
      }
      this.cancelVoiceRestart();
      this.voiceActivated = false;
      setVoiceButtonActive(false);
      this.setState("READY");
    });
  }

  scheduleVoiceRestart() {
    if (!this.nativeVoice || !this.voiceActivated || this.isSpeaking || this.isProcessing) return;
    this.cancelVoiceRestart();
    if (this.voiceSilenceRetries >= 4) {
      this.voiceActivated = false;
      this.nativeVoiceReady = false;
      this.setState("READY");
      setVoiceButtonActive(false);
      this.voiceSilenceRetries = 0;
      return;
    }
    this.voiceSilenceRetries += 1;
    this.voiceRestartTimer = setTimeout(() => {
      this.voiceRestartTimer = null;
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing) this.startListening();
    }, 350);
  }

  cancelVoiceRestart() {
    if (this.voiceRestartTimer) {
      clearTimeout(this.voiceRestartTimer);
      this.voiceRestartTimer = null;
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
      this.cancelVoiceRestart();
      if (!this.isSpeaking && !this.isProcessing && this.voiceActivated) this.setState("LISTENING");
    };
    this.recognition.onresult = event => this.handleResult(event);
    this.recognition.onerror = event => {
      this.isListening = false;
      console.warn("Speech recognition error:", event.error);
      if (this.isProcessing || this.isSpeaking) return;
      this.voiceActivated = false;
      setVoiceButtonActive(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") this.setState("MICROPHONE DENIED");
      else this.setState("READY");
    };
    this.recognition.onend = () => {
      this.isListening = false;
      if (this.isSpeaking || this.isProcessing) return;
      if (this.voiceActivated && !this.intentionalStop) {
        this.voiceActivated = false;
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
    this.cancelVoiceRestart();
    this.voiceSilenceRetries = 0;
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
    this.nativeVoiceReady = false;
    this.voiceSilenceRetries = 0;
    this.cancelVoiceRestart();
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
      this.isListening = true;
      this.setState("LISTENING");
      try { window.HaivaBridge.startVoiceCapture(); }
      catch (error) {
        this.isListening = false;
        this.voiceActivated = false;
        this.nativeVoiceReady = false;
        setVoiceButtonActive(false);
        this.setState("VOICE ERROR");
      }
      return;
    }
    if (!this.recognition) return;
    try { this.recognition.start(); } catch (error) { console.debug("Recognition start skipped:", error?.message || error); }
  }

  stopListening() {
    this.intentionalStop = true;
    this.cancelVoiceRestart();
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
      const result = event.results[i];
      const text = result[0]?.transcript || "";
      if (result.isFinal) finalText += text;
      else interimText += text;
    }
    const normalizedInterim = normalizeSpeech(interimText.trim());
    if (normalizedInterim) this.showTranscript(normalizedInterim);

    const normalizedFinal = normalizeSpeech(finalText.trim());
    if (normalizedFinal) {
      this.isListening = false;
      void this.handleResultText(normalizedFinal);
    }
  }

  async handleResultText(text) {
    const command = removeWakeWord(text).trim();
    if (!command) {
      this.voiceActivated = false;
      this.cancelVoiceRestart();
      setVoiceButtonActive(false);
      this.setState("READY");
      return;
    }
    await this.handleTextCommand(command, true);
  }
}

const app = new HAIVA();
window.HAIVA = app;
bootCheckpoint("APP_INSTANCE_EXPOSED", "window.HAIVA available");
