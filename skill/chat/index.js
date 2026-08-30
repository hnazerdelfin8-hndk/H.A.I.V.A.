// =========================================
// H.A.I.V.A. Chat Skill
// =========================================

import { CONFIG } from "../../core/config.js";

const chatEndpoint = CONFIG.api.chatEndpoint;

/**
 * Execute the Chat Skill
 */
export async function execute(message) {
  if (!message || typeof message !== "string") {
    throw new Error("Chat message is required.");
  }

  const response = await fetch(chatEndpoint, {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      message: message.trim()
    })
  });

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Invalid response from AI server.");
  }

  if (!response.ok) {
    throw new Error(
      data?.error || "AI request failed."
    );
  }

  return data?.reply || "No response received.";
}

console.log("H.A.I.V.A. Chat Skill loaded.");
