// =========================================
// H.A.I.V.A. UI Bridge
// Connects UI → Core → Gemini → Voice
// =========================================

import { processRequest } from "./assistant.js";

import {
  setStatus,
  setTranscript,
  setReply,
  setOrbState,
  setConversationMode,
  setListening
} from "../ui/ui.js";


// -----------------------------------------
// Speech Recognition
// -----------------------------------------

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;
let processing = false;


// -----------------------------------------
// Text-to-Speech
// -----------------------------------------

function speak(text) {

  if (!text || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang = "fil-PH";
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {

    setStatus("Speaking...");
    setOrbState("speaking");

  };

  utterance.onend = () => {

    setStatus("Ready");
    setOrbState(null);

  };

  utterance.onerror = (event) => {

    console.error(
      "H.A.I.V.A. speech synthesis error:",
      event.error
    );

    setStatus("Ready");
    setOrbState(null);

  };

  window.speechSynthesis.speak(
    utterance
  );
}


// -----------------------------------------
// Check Speech Recognition Support
// -----------------------------------------

if (!SpeechRecognition) {

  console.warn(
    "H.A.I.V.A.: Speech Recognition is not supported."
  );

} else {

  recognition =
    new SpeechRecognition();

  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;


  // ---------------------------------------
  // Speech Started
  // ---------------------------------------

  recognition.onstart = () => {

    setListening(true);
    setStatus("Listening...");
    setOrbState("active");

  };


  // ---------------------------------------
  // Speech Result
  // ---------------------------------------

  recognition.onresult = async (event) => {

    const result =
      event.results?.[0]?.[0]?.transcript;

    if (!result) {
      return;
    }

    const message =
      result.trim();

    if (!message) {
      return;
    }

    setTranscript(message);

    setStatus("Thinking...");
    setOrbState("thinking");

    processing = true;

    try {

      // Send request through Core
      const response =
        await processRequest(
          "chat",
          message
        );

      const spokenText =
        typeof response === "string"
          ? response
          : "No response received.";

      // Display Gemini response
      setReply(spokenText);

      // Speak Gemini response
      speak(spokenText);

    } catch (error) {

      console.error(
        "H.A.I.V.A. request failed:",
        error
      );

      const errorMessage =
        error?.message ||
        "H.A.I.V.A. could not process your request.";

      setReply(errorMessage);
      setStatus("Error");
      setOrbState(null);

    } finally {

      processing = false;
      setListening(false);

    }
  };


  // ---------------------------------------
  // Speech Error
  // ---------------------------------------

  recognition.onerror = (event) => {

    console.error(
      "H.A.I.V.A. speech recognition error:",
      event.error
    );

    processing = false;

    setListening(false);
    setOrbState(null);

    if (event.error === "no-speech") {

      setStatus(
        "No speech detected."
      );

    } else if (
      event.error === "not-allowed"
    ) {

      setStatus(
        "Microphone permission denied."
      );

    } else {

      setStatus(
        "Voice recognition error."
      );

    }
  };


  // ---------------------------------------
  // Speech Ended
  // ---------------------------------------

  recognition.onend = () => {

    setListening(false);

    if (!processing) {
      setOrbState(null);
    }

  };
}


// -----------------------------------------
// Microphone Button
// -----------------------------------------

const micButton =
  document.getElementById(
    "micButton"
  );


if (micButton) {

  micButton.addEventListener(
    "click",
    () => {

      if (!recognition) {

        setStatus(
          "Speech recognition is not supported."
        );

        return;
      }

      if (processing) {
        return;
      }


      // Stop listening
      if (
        micButton.classList.contains(
          "listening"
        )
      ) {

        recognition.stop();

        setConversationMode(false);
        setListening(false);

        return;
      }


      // Stop any existing speech
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }


      // Start listening
      setConversationMode(true);

      try {

        recognition.start();

      } catch (error) {

        console.error(
          "H.A.I.V.A. could not start speech recognition:",
          error
        );

        setConversationMode(false);
        setListening(false);

        setStatus(
          "Unable to start microphone."
        );

      }
    }
  );
}


// -----------------------------------------
// Bridge Ready
// -----------------------------------------

console.log(
  "H.A.I.V.A. UI Bridge loaded."
);
