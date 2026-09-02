// =========================================
// H.A.I.V.A. SKILL MANAGER
// =========================================

import { clearMemory, getMemoryCount, getRecentMemory, forgetLast } from "./memory.js";
import { webSearch } from "./skills/web-search.js";
import { weather } from "./skills/weather.js";
import { reminder } from "./skills/reminder.js";

const skills = new Map();

export function registerSkill(name, skill) {
  if (!name || typeof skill !== "function") throw new Error("Invalid skill registration.");
  skills.set(name.toLowerCase(), skill);
  console.log(`H.A.I.V.A. skill registered: ${name}`);
}

export function getSkill(name) {
  return name ? skills.get(name.toLowerCase()) || null : null;
}

export function hasSkill(name) {
  return !!name && skills.has(name.toLowerCase());
}

export function getSkills() {
  return Array.from(skills.keys());
}

export function unregisterSkill(name) {
  return !!name && skills.delete(name.toLowerCase());
}

export async function executeSkill(command, brainContext = {}) {
  if (!command) return null;
  const text = String(command).toLowerCase().trim();
  const intent = brainContext?.intent?.name || "unknown";

  if (["hello", "hi", "hey", "hello haiva", "hey haiva"].includes(text)) {
    return "Hello, Master. I'm here and listening.";
  }

  if (text.includes("what time") || text.includes("current time") || text === "time") {
    return `The current time is ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
  }

  if (text.includes("what date") || text.includes("today's date") || text.includes("what day") || text === "date") {
    return `Today is ${new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`;
  }

  if (text === "status" || text.includes("system status") || text.includes("are you online")) {
    return "All core systems are online, Master. Voice, memory, command routing and AI connection are ready.";
  }

  if (text === "who are you" || text.includes("what are you")) {
    return "I am H.A.I.V.A., your personal artificial intelligence voice assistant. I'm designed to help you naturally through conversation and commands.";
  }

  if (text.includes("clear memory") || text.includes("forget everything") || text.includes("forget all memory")) {
    clearMemory();
    return "Done, Master. My saved conversation memory has been cleared.";
  }

  if (text.includes("forget the last") || text.includes("forget that")) {
    forgetLast(2);
    return "Understood, Master. I removed the most recent conversation memory.";
  }

  if (text.includes("how many memories") || text.includes("memory count")) {
    return `I currently have ${getMemoryCount()} stored conversation entries, Master.`;
  }

  if (text.includes("what do you remember") || text.includes("show my recent memory")) {
    const recent = getRecentMemory(6);
    if (!recent.length) return "I don't have any saved conversation memory yet, Master.";
    const lines = recent.map(item => `${item.role}: ${item.content}`).join(" | ");
    return `My recent memory is: ${lines}`;
  }

  if (text === "help" || text.includes("what can you do")) {
    return "I can answer questions, understand conversation context, remember useful history, handle local commands, and use registered skills. You can speak naturally, Master.";
  }

  if (intent !== "unknown") {
    const intentSkill = skills.get(intent);
    if (intentSkill) {
      try { return await intentSkill(command, brainContext); }
      catch (error) {
        console.error(`Skill "${intent}" failed:`, error);
        return null;
      }
    }
  }

  for (const [name, skill] of skills.entries()) {
    if (text === name || text.includes(name)) {
      try { return await skill(command, brainContext); }
      catch (error) {
        console.error(`Skill "${name}" failed:`, error);
        return null;
      }
    }
  }

  return null;
}

let defaultsRegistered = false;

export function registerDefaultSkills() {
  if (defaultsRegistered) return;
  defaultsRegistered = true;

  registerSkill("weather", weather);
  registerSkill("web_search", webSearch);
  registerSkill("reminder", reminder);
}
