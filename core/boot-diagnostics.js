// H.A.I.V.A. persistent boot checkpoint diagnostics.
// Stores the last reached runtime boundary in sessionStorage/localStorage so
// APK failures can be identified after the WebView has stopped executing.

const STORAGE_KEY = "haiva.boot.checkpoints.v1";
const MAX_CHECKPOINTS = 50;
const FATAL_STAGE_PATTERN = /(?:FAILED|ERROR|TIMEOUT|REJECTED|LOAD_FAILED)/;

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

  // Fatal boot checkpoints must be visible to the outer boot guard. This is
  // deliberately one-way: a fatal boundary cannot be overwritten by a later
  // READY state emitted by a recovery path.
  if (FATAL_STAGE_PATTERN.test(String(stage))) {
    try {
      window.dispatchEvent(new CustomEvent("haiva:boot-failure", {
        detail: { stage: String(stage), message: String(detail || "Boot failure") }
      }));
    } catch (error) {
      console.warn("[HAIVA-BOOT] failure event dispatch failed:", error);
    }
  }

  return entry;
}

export function bootDiagnosticsSnapshot() {
  return readCheckpoints();
}

bootCheckpoint("DIAGNOSTICS_MODULE_LOADED");
