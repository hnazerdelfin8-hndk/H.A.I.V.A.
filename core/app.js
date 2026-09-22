// =========================================
// H.A.I.V.A. MAIN APPLICATION
// =========================================

import "../ui/polish.js";
import "./haiva-orb.js";
import { initializeHAIVA } from "./initializer.js";
import { CONFIG } from "./config.js";
import { HAIVAAssistant } from "./assistant.js";
import { setUIState, setVoiceButtonActive, hasNativeVoiceBridge } from "./ui-bridge.js";
import { bootCheckpoint } from "./boot-diagnostics.js";
import { VoiceInteraction } from "./voice/interaction.js";

bootCheckpoint("JS_ENTRY_STARTED", "core/app.js module evaluated");

class HAIVA {
  constructor() {
    bootCheckpoint("HAIVA_CONSTRUCTOR_STARTED");
    this.state = "BOOTING";
    this.nativeVoice = hasNativeVoiceBridge();
    this.voiceActivated = false;
    this.isListening = false;
    this.isSpeaking = false;
    this.isProcessing = false;
    this.voiceTurn = 0;
    this.pendingVoiceResult = false;
    this.assistant = new HAIVAAssistant();
    this.lastTranscript = "";

    this.voiceInteraction = new VoiceInteraction({
      onInput: (command, detail) => {
        this.voiceActivated = this.voiceInteraction.active;
        this.voiceTurn = detail.turn;
        this.pendingVoiceResult = this.voiceInteraction.pendingResult;
        void this.handleTextCommand(command, true);
      },
      onBrainDecision: (text, context) => this.assistant.decideVoiceInput(text, context?.phase || "LISTENING"),
      onStateChange: state => {
        this.isListening = this.voiceInteraction.listening;
        this.isSpeaking = this.voiceInteraction.speaking;
        this.isProcessing = this.voiceInteraction.processing;
        this.voiceActivated = this.voiceInteraction.active;
        this.setState(state);
        setVoiceButtonActive(this.voiceActivated);
      },
      onTranscript: text => {
        this.lastTranscript = text;
        this.showTranscript(text);
      },
      onOutcome: detail => {
        if (detail?.type === "VOICE_ERROR") this.setState("VOICE ERROR");
      }
    });

    this.setupChat();
    this.setupSettings();
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
      this.voiceInteraction.initialize();
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
    const voiceDecision = isVoiceTurn
      ? this.assistant.decideVoiceInput(command, "LISTENING")
      : null;

    if (isVoiceTurn) {
      this.voiceInteraction.beginProcessing();
      this.voiceActivated = this.voiceInteraction.active;
      this.voiceTurn = this.voiceInteraction.turn;
    } else {
      this.isProcessing = true;
      this.setState("THINKING");
    }

    this.showTranscript(command);

    try {
      const response = await this.assistant.respond(command);
      const answer = response || CONFIG.assistant.fallbackResponse;
      this.showResponse(answer);

      if (speakResponse) {
        const completedTurn = await this.voiceInteraction.beginSpeaking(answer);
        if (!completedTurn) return;
        this.voiceInteraction.finishCommand(Boolean(voiceDecision?.endConversation));
      } else {
        this.setState("READY");
      }
    } catch (error) {
      console.error("Text command failed:", error);
      this.showResponse(CONFIG.assistant.fallbackResponse);
      if (speakResponse) this.voiceInteraction.finishCommand(true);
      this.setState("ERROR");
    } finally {
      if (!speakResponse) this.isProcessing = false;
      this.isListening = this.voiceInteraction.listening;
      this.isSpeaking = this.voiceInteraction.speaking;
      this.voiceActivated = this.voiceInteraction.active;
      this.pendingVoiceResult = this.voiceInteraction.pendingResult;
      this.voiceTurn = this.voiceInteraction.turn;
      if (this.state === "ERROR") this.setState("READY");
      setVoiceButtonActive(this.voiceActivated);
    }
  }

  async activateVoice() {
    const activated = this.voiceInteraction.activate();
    if (!activated) {
      this.voiceActivated = false;
      setVoiceButtonActive(false);
      this.setState("VOICE UNAVAILABLE");
      return false;
    }
    this.voiceActivated = true;
    this.voiceTurn = this.voiceInteraction.turn;
    this.pendingVoiceResult = false;
    this.lastTranscript = "";
    setVoiceButtonActive(true);
    return true;
  }

  deactivateVoice() {
    this.voiceInteraction.deactivate();
    this.voiceActivated = false;
    this.isListening = false;
    this.isSpeaking = false;
    this.isProcessing = false;
    this.pendingVoiceResult = false;
    this.lastTranscript = "";
    setVoiceButtonActive(false);
    this.setState("READY");
    const heard = document.getElementById("heard");
    if (heard) heard.textContent = "Ready. Tap the microphone or continue the conversation.";
  }

  setupReminderNotifications() {
    window.addEventListener("haiva:reminder", async event => {
      const message = event.detail?.message;
      if (!message || !this.voiceInteraction.active) return;
      const response = `Reminder: ${message}.`;
      this.showResponse(response);
      const completedTurn = await this.voiceInteraction.beginSpeaking(response);
      if (!completedTurn) return;
      this.voiceInteraction.finishCommand(false);
    });
  }

  setState(state) {
    this.state = state;
    setUIState(state);
    window.HAIVAOrb?.setState(state);
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
}

const app = new HAIVA();
window.HAIVA = app;
bootCheckpoint("APP_INSTANCE_EXPOSED", "window.HAIVA available");
