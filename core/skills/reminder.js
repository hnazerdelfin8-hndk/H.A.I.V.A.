// =========================================
// H.A.I.V.A. SKILL — LOCAL REMINDERS
// =========================================

const STORAGE_KEY = "haiva_reminders_v1";

function loadReminders() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveReminders(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function parseDelay(text) {
  const match = text.match(/(?:in|after)\s+(\d+(?:\.\d+)?)\s*(second|seconds|minute|minutes|hour|hours|day|days)\b/i);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    second: 1000, seconds: 1000,
    minute: 60000, minutes: 60000,
    hour: 3600000, hours: 3600000,
    day: 86400000, days: 86400000
  };
  return Date.now() + value * multipliers[unit];
}

function extractMessage(text) {
  return text
    .replace(/\b(remind me|reminder|to remind me)\b/gi, "")
    .replace(/\b(in|after)\s+\d+(?:\.\d+)?\s*(second|seconds|minute|minutes|hour|hours|day|days)\b/gi, "")
    .replace(/\bto\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function reminder(command) {
  const text = String(command || "").trim();
  const when = parseDelay(text);

  if (!when) {
    return "Tell me when you want the reminder, for example: remind me in 10 minutes to check the oven.";
  }

  const message = extractMessage(text) || "your reminder";
  const reminders = loadReminders();
  const reminderItem = { id: crypto.randomUUID(), message, when, createdAt: Date.now() };
  reminders.push(reminderItem);
  saveReminders(reminders);

  setTimeout(() => {
    const current = loadReminders();
    const found = current.find(item => item.id === reminderItem.id);
    if (!found) return;

    window.dispatchEvent(new CustomEvent("haiva:reminder", { detail: found }));
    saveReminders(current.filter(item => item.id !== found.id));
  }, Math.max(0, when - Date.now()));

  const delay = Math.max(0, when - Date.now());
  const minutes = Math.round(delay / 60000);
  const timing = minutes < 1 ? "less than a minute" : `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `Okay. I'll remind you in ${timing} to ${message}.`;
}

export function getReminders() {
  return loadReminders().sort((a, b) => a.when - b.when);
}
