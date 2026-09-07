// H.A.I.V.A. persistent boot checkpoint diagnostics.
// Stores the last reached runtime boundary in sessionStorage/localStorage so
// APK failures can be identified after the WebView has stopped executing.

const STORAGE_KEY = "haiva.boot.checkpoints.v1";
const MAX_CHECKPOINTS = 50;

function readCheckpoints() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function bootCheckpoint(stage, detail = "") {
  const entry = {
    stage,
    detail: String(detail || ""),
    timestamp: new Date().toISOString()
  };

  const checkpoints = [...readCheckpoints(), entry].slice(-MAX_CHECKPOINTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checkpoints));
    sessionStorage.setItem("haiva.boot.last", JSON.stringify(entry));
  } catch (error) {
    console.warn("[HAIVA-BOOT] checkpoint persistence failed:", error);
  }

  console.log(`[HAIVA-BOOT] ${stage}`, detail || "");
  return entry;
}

export function bootDiagnosticsSnapshot() {
  return readCheckpoints();
}

bootCheckpoint("DIAGNOSTICS_MODULE_LOADED");
