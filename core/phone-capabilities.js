// =========================================
// H.A.I.V.A. PHONE CAPABILITIES
// Deterministic device actions stay outside the AI brain.
// =========================================

function nativeBridge() {
  if (typeof window === "undefined" || !window.HaivaBridge) return null;
  return window.HaivaBridge;
}

function parseResult(value) {
  try { return JSON.parse(String(value)); }
  catch (_) { return { success: false, error: "Invalid native capability response" }; }
}

export function isPhoneBridgeAvailable() {
  const bridge = nativeBridge();
  return !!bridge && ["getBattery", "getDeviceInfo", "openApp"].some(name => typeof bridge[name] === "function");
}

export function getBattery() {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.getBattery !== "function") {
    return { success: false, error: "Phone bridge unavailable" };
  }
  return parseResult(bridge.getBattery());
}

export function getDeviceInfo() {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.getDeviceInfo !== "function") {
    return { success: false, error: "Phone bridge unavailable" };
  }
  return parseResult(bridge.getDeviceInfo());
}

export function openApp(name) {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.openApp !== "function") {
    return { success: false, error: "Phone bridge unavailable" };
  }
  return parseResult(bridge.openApp(String(name || "")));
}

export function classifyPhoneCommand(command) {
  const text = String(command || "").toLowerCase().trim();
  if (/\b(battery|charge|battery level)\b/.test(text)) return { action: "battery" };
  if (/\b(device info|phone info|what phone|which phone)\b/.test(text)) return { action: "device-info" };

  const app = text.match(/\b(?:open|launch|start)\s+(youtube|chrome|gmail|maps|spotify)\b/);
  if (app) return { action: "open-app", app: app[1] };
  return null;
}

export function executePhoneCommand(command) {
  const intent = classifyPhoneCommand(command);
  if (!intent || !isPhoneBridgeAvailable()) return null;

  if (intent.action === "battery") {
    const result = getBattery();
    return result.success ? `Your phone battery is at ${result.level}%.` : null;
  }

  if (intent.action === "device-info") {
    const result = getDeviceInfo();
    return result.success ? `You're using a ${result.manufacturer} ${result.model} running Android ${result.androidVersion}.` : null;
  }

  if (intent.action === "open-app") {
    const result = openApp(intent.app);
    return result.success ? `Opening ${intent.app}.` : `I couldn't open ${intent.app}: ${result.error || "unknown error"}.`;
  }

  return null;
}
