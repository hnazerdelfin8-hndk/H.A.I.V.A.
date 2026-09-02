// =========================================
// H.A.I.V.A. SKILL — AUTOMATION
// =========================================

const STORAGE_KEY = "haiva_automations_v1";

function loadAutomations() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveAutomations(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function extractDelay(text) {
  const match = text.match(/(?:in|after)\s+(\d+(?:\.\d+)?)\s*(second|seconds|minute|minutes|hour|hours|day|days)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  const units = {
    second: 1000, seconds: 1000,
    minute: 60000, minutes: 60000,
    hour: 3600000, hours: 3600000,
    day: 86400000, days: 86400000
  };
  return value * units[match[2].toLowerCase()];
}

function extractAction(text) {
  return text
    .replace(/^\s*(automate|automation)\s*/i, "")
    .replace(/^\s*(in|after)\s+\d+(?:\.\d+)?\s*(second|seconds|minute|minutes|hour|hours|day|days)\b/i, "")
    .replace(/^\s*(to|that)\s+/i, "")
    .trim();
}

export function automation(command) {
  const text = String(command || "").trim();
  const delay = extractDelay(text);
  const action = extractAction(text);

  if (!delay || !action) {
    return "Tell me the action and timing, for example: automate in 10 minutes to remind me to check the oven.";
  }

  const item = {
    id: crypto.randomUUID(),
    action,
    runAt: Date.now() + delay,
    createdAt: Date.now()
  };

  const items = loadAutomations();
  items.push(item);
  saveAutomations(items);

  setTimeout(() => {
    const current = loadAutomations();
    const found = current.find(entry => entry.id === item.id);
    if (!found) return;

    window.dispatchEvent(new CustomEvent("haiva:automation", { detail: found }));
    saveAutomations(current.filter(entry => entry.id !== found.id));
  }, delay);

  const minutes = Math.round(delay / 60000);
  const timing = minutes < 1 ? "less than a minute" : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `Automation scheduled, Master. I'll trigger it in ${timing}: ${action}`;
}

export function getAutomations() {
  return loadAutomations().sort((a, b) => a.runAt - b.runAt);
}
