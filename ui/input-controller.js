// =========================================
// H.A.I.V.A. INPUT CONTROLLER
// Wires chat + microphone controls to the assistant.
// =========================================

import { HAIVAAssistant } from "../core/assistant.js";
import { setStatus, setTranscript, setReply, setOrbState, setConversationMode, setListening } from "./ui.js";

const assistant = new HAIVAAssistant();
const micButton = document.getElementById("micButton");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");

let recognition = null;
let recognizing = false;

function speak(text) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

async function handleText(text) {
  const command = String(text || "").trim();
  if (!command || assistant.processing) return;

  setTranscript(command);
  setStatus("Thinking...");
  setOrbState("thinking");

  try {
    const response = await assistant.respond(command);
    if (response) {
      setReply(response);
      speak(response);
    }
  } catch (error) {
    console.error("[HAIVA] input handling failed", error);
    setReply("I couldn't process that request.");
  } finally {
    setOrbState(null);
    setStatus("Ready");
  }
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return false;

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    recognizing = true;
    setListening(true);
    setConversationMode(true);
  };

  recognition.onresult = async (event) => {
    const text = event.results?.[0]?.[0]?.transcript || "";
    await handleText(text);
  };

  recognition.onerror = (event) => {
    console.error("[HAIVA] speech recognition error", event.error);
    setReply(event.error === "not-allowed"
      ? "Microphone permission was denied. Please allow microphone access for H.A.I.V.A."
      : "I couldn't hear you. Please try again.");
  };

  recognition.onend = () => {
    recognizing = false;
    setListening(false);
    setConversationMode(false);
    setStatus("Ready");
  };

  return true;
}

function startMicrophone() {
  if (!recognition && !setupSpeechRecognition()) {
    setReply("Voice recognition is not available in this WebView. Chat mode is still available.");
    return;
  }

  if (recognizing) {
    recognition.stop();
    return;
  }

  try {
    recognition.start();
  } catch (error) {
    console.error("[HAIVA] unable to start microphone", error);
  }
}

micButton?.addEventListener("click", startMicrophone);
sendButton?.addEventListener("click", () => {
  const text = chatInput?.value || "";
  if (chatInput) chatInput.value = "";
  handleText(text);
});

chatInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    const text = chatInput.value;
    chatInput.value = "";
    handleText(text);
  }
});

console.log("H.A.I.V.A. input controller loaded.");
