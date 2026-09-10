// =========================================
// H.A.I.V.A. MAIN APPLICATION
// =========================================

import "../ui/polish.js";
import { initializeHAIVA } from "./initializer.js";
import { CONFIG } from "./config.js";
import { HAIVAAssistant } from "./assistant.js";
import { createSpeechRecognition } from "./voice/speech-to-text.js";
import { v1Capture } from "./voice/v1/capture-controller.js";
import { VoiceLifecycleV2 } from "./voice/v2/lifecycle-coordinator.js";
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
    this.voiceSilenceRetries = 0;
    this.voiceTurn = 0;
    this.pendingVoiceResult = false;
    this.conversationalVoice = true;
    this.voiceLifecycle = new VoiceLifecycleV2();
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
    const isVoiceTurn = Boolean(speakResponse);
    const isInterrupt = isVoiceTurn && this.voiceLifecycle.state === "SPEAKING";
    const shouldEndConversation = isVoiceTurn && this.voiceLifecycle.shouldEndConversation(command);
    this.isProcessing = true;
    this.stopListening();
    this.showTranscript(command);
    if (isVoiceTurn) {
      if (isInterrupt) this.voiceLifecycle.interruptToThinking();
      else this.voiceLifecycle.beginThinking();
    }
    this.setState("THINKING");
    try {
      const response = await this.assistant.respond(command);
      const answer = response || CONFIG.assistant.fallbackResponse;
      this.showResponse(answer);
      if (speakResponse) {
        this.isSpeaking = true;
        this.voiceLifecycle.beginSpeaking();
        this.setState("SPEAKING");
        try { await speak(answer); }
        catch (speechError) { console.warn("Voice response failed:", speechError); }
        finally { this.isSpeaking = false; }
      }
      if (isVoiceTurn) {
        if (shouldEndConversation) this.voiceLifecycle.endSession();
        else if (!this.voiceLifecycle.isConversationActive()) this.voiceLifecycle.startSession();
        if (!shouldEndConversation) this.voiceLifecycle.returnToListening();
      } else {
        this.setState("READY");
      }
    } catch (error) {
      console.error("Text command failed:", error);
      this.showResponse(CONFIG.assistant.fallbackResponse);
      if (isVoiceTurn) this.voiceLifecycle.endSession();
      this.setState("ERROR");
    } finally {
      this.isProcessing = false;
      this.isSpeaking = false;
      this.voiceSilenceRetries = 0;
      this.pendingVoiceResult = false;
      if (this.state === "ERROR") this.setState("READY");
      this.voiceActivated = isVoiceTurn && this.conversationalVoice && this.voiceLifecycle.isConversationActive();
      this.nativeVoiceReady = false;
      setVoiceButtonActive(this.voiceActivated);
      if (this.voiceActivated) this.startListening();
    }
  }

  setupNativeVoiceEvents() {
    if (!this.nativeVoice) return;
    window.addEventListener("haiva:native-voice-ready", () => {
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.nativeVoiceReady = true;
        this.isListening = true;
        this.setState("LISTENING");
      }
    });
    window.addEventListener("haiva:native-voice-begin", () => {
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.voiceSilenceRetries = 0;
        this.nativeVoiceReady = true;
        this.isListening = true;
        this.setState("LISTENING");
      }
    });
    window.addEventListener("haiva:native-voice-segment-end", () => {
      if (this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.nativeVoiceReady = false;
        this.isListening = true;
        this.setState("LISTENING");
      }
    });
    window.addEventListener("haiva:native-voice-partial", event => {
      const text = event.detail?.text?.trim();
      if (text && this.voiceActivated && !this.isSpeaking && !this.isProcessing) {
        this.voiceSilenceRetries = 0;
        this.nativeVoiceReady = true;
        this.isListening = true;
        this.lastTranscript = normalizeSpeech(text);
        this.showTranscript(this.lastTranscript);
        this.setState("LISTENING");
      }
    });
    window.addEventListener("haiva:native-voice-result", event => {
      const text = event.detail?.text?.trim();
      if (!text || this.isSpeaking || this.isProcessing || !this.voiceActivated || this.pendingVoiceResult) return;
      this.pendingVoiceResult = true;
      this.voiceSilenceRetries = 0;
      this.isListening = false;
      this.nativeVoiceReady = false;
      void this.handleResultText(text);
    });
    window.addEventListener("haiva:native-voice-timeout", () => {
      if (this.isSpeaking || this.isProcessing) return;
      this.isListening = false;
      this.nativeVoiceReady = false;
      if (this.voiceActivated && this.conversationalVoice) {
        this.setState("READY");
        return;
      }
      this.voiceActivated = false;
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
        this.recoverNativeVoiceFromEvent(code);
        return;
      }
      this.voiceActivated = false;
      setVoiceButtonActive(false);
      this.setState("READY");
    });
  }

  recoverNativeVoiceFromEvent(code) {
    if (!this.nativeVoice || !this.voiceActivated || this.isSpeaking || this.isProcessing) return;
    if (this.voiceSilenceRetries >= 4) {
      console.warn("[HAIVA] Native voice recovery limit reached:", code);
      this.voiceActivated = false;
      this.nativeVoiceReady = false;
      this.voiceSilenceRetries = 0;
      setVoiceButtonActive(false);
      this.setState("READY");
      return;
    }
    this.voiceSilenceRetries += 1;
    this.startListening();
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
    else if (state === "LISTENING") heard.textContent = "Listening… speak naturally.";
    else if (state === "THINKING") heard.textContent = "Analyzing your request…";
    else if (state === "SPEAKING") heard.textContent = "H.A.I.V.A. is responding…";
    else if (state === "READY") heard.textContent = "Ready. Tap the microphone or continue the conversation.";
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
    this.recognition.onspeechstart = () => {
      if (!this.voiceActivated || this.isSpeaking || this.isProcessing) return;
      this.setState("LISTENING");
    };
    this.recognition.onspeechend = () => {
      if (!this.voiceActivated || this.isSpeaking || this.isProcessing) return;
      this.isListening = false;
    };
    this.recognition.onresult = event => this.handleResult(event);
    this.recognition.onerror = event => {
      this.isListening = false;
      console.warn("Speech recognition error:", event.error);
      if (this.isProcessing || this.isSpeaking) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.voiceActivated = false;
        setVoiceButtonActive(false);
        this.setState("MICROPHONE DENIED");
        return;
      }
      if (["no-speech", "aborted", "audio-capture"].includes(event.error) && this.voiceActivated) {
        this.recoverRecognitionFromEvent(event.error);
        return;
      }
      this.voiceActivated = false;
      setVoiceButtonActive(false);
      this.setState("READY");
    };
    this.recognition.onend = () => {
      this.isListening = false;
      if (this.isSpeaking || this.isProcessing) return;
      if (this.voiceActivated && !this.intentionalStop) {
        this.startListening();
        return;
      }
      if (this.intentionalStop) this.intentionalStop = false;
      this.setState("READY");
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
    this.voiceSilenceRetries = 0;
    this.voiceActivated = true;
    this.voiceLifecycle.startSession();
    this.voiceLifecycle.transition("LISTENING");
    this.intentionalStop = false;
    this.lastTranscript = "";
    this.pendingVoiceResult = false;
    setVoiceButtonActive(true);
    this.setState("LISTENING");
    this.startListening();
  }

  deactivateVoice() {
    this.voiceActivated = false;
    this.voiceLifecycle.endSession();
    this.lastTranscript = "";
    this.pendingVoiceResult = false;
    this.nativeVoiceReady = false;
    this.voiceSilenceRetries = 0;
    this.stopListening();
    window.speechSynthesis?.cancel?.();
    this.isSpeaking = false;
    this.isProcessing = false;
    setVoiceButtonActive(false);
    this.setState("READY");
    const heard = document.getElementById("heard");
    if (heard) heard.textContent = "Ready. Tap the microphone or continue the conversation.";
  }

  startListening() {
    if (!this.voiceActivated || this.isListening || this.isSpeaking || this.isProcessing) return;
    this.intentionalStop = false;
    if (this.nativeVoice) {
      this.isListening = true;
      this.voiceLifecycle.transition("LISTENING");
      this.setState("LISTENING");
      v1Capture.startCapture();
      return;
    }
    if (!this.recognition) return;
    try { this.recognition.start(); } catch (error) { console.debug("Recognition start skipped:", error?.message || error); }
  }

  stopListening() {
    this.intentionalStop = true;
    if (this.nativeVoice) {
      v1Capture.stopCapture();
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch (error) { console.debug("Recognition stop skipped:", error?.message || error); }
    }
    this.isListening = false;
  }

  recoverRecognitionFromEvent(reason) {
    if (!this.voiceActivated || this.isSpeaking || this.isProcessing) return;
    if (this.voiceSilenceRetries >= 4) {
      console.warn("[HAIVA] Browser voice recovery limit reached:", reason);
      this.voiceActivated = false;
      this.voiceSilenceRetries = 0;
      setVoiceButtonActive(false);
      this.setState("READY");
      return;
    }
    this.voiceSilenceRetries += 1;
    this.startListening();
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
    if (normalizedInterim) {
      this.lastTranscript = normalizedInterim;
      this.showTranscript(normalizedInterim);
    }

    const normalizedFinal = normalizeSpeech(finalText.trim());
    if (normalizedFinal && !this.pendingVoiceResult) {
      this.pendingVoiceResult = true;
      this.isListening = false;
      void this.handleResultText(normalizedFinal);
    }
  }

  async handleResultText(text) {
    const command = removeWakeWord(text).trim();
    if (!command) {
      this.pendingVoiceResult = false;
      if (this.conversationalVoice && this.voiceActivated) {
        this.startListening();
      } else {
        this.voiceActivated = false;
        this.voiceLifecycle.endSession();
        setVoiceButtonActive(false);
        this.setState("READY");
      }
      return;
    }
    await this.handleTextCommand(command, true);
  }
}

const app = new HAIVA();
window.HAIVA = app;
bootCheckpoint("APP_INSTANCE_EXPOSED", "window.HAIVA available");