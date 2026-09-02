// =========================================
// H.A.I.V.A. SKILL — MUSIC
// =========================================

export function music(command) {
  const text = String(command || "").trim();
  const query = text
    .replace(/^\s*(play|start)\s+(some\s+|a\s+)?music\s*/i, "")
    .replace(/^\s*(play|start)\s+(the\s+)?song\s*/i, "")
    .trim();

  if (!query) {
    return "Tell me what song, artist, or music you want to play, Master.";
  }

  // The browser cannot reliably control every music service.
  // Return a safe handoff URL that can be opened by the UI later.
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  return `I found a music search for ${query}. ${url}`;
}
