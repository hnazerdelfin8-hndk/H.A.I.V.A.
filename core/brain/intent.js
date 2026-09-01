// =========================================
// H.A.I.V.A. BRAIN — INTENT DETECTION
// =========================================

const PATTERNS = [
  { intent: "weather", patterns: [/\bweather\b/i, /\bforecast\b/i, /\btemperatur(e)?\b/i] },
  { intent: "web_search", patterns: [/\bsearch\b/i, /\blook up\b/i, /\bfind online\b/i, /\bgoogle\b/i] },
  { intent: "calendar", patterns: [/\bcalendar\b/i, /\bschedule\b/i, /\bappointment\b/i, /\bmeeting\b/i] },
  { intent: "reminder", patterns: [/\bremind\b/i, /\breminder\b/i, /\bremember to\b/i] },
  { intent: "notes", patterns: [/\bnote\b/i, /\bnotes\b/i, /\bwrite this down\b/i, /\bsave this\b/i] },
  { intent: "music", patterns: [/\bplay music\b/i, /\bplay a song\b/i, /\bmusic\b/i] },
  { intent: "email", patterns: [/\bemail\b/i, /\be-mail\b/i, /\bsend an email\b/i] },
  { intent: "finance", patterns: [/\bfinance\b/i, /\bstock\b/i, /\bprice of\b/i, /\bexchange rate\b/i, /\bcurrency\b/i] },
  { intent: "business", patterns: [/\bbusiness\b/i, /\bsales\b/i, /\bmarketing\b/i] },
  { intent: "social_media", patterns: [/\bfacebook\b/i, /\binstagram\b/i, /\btiktok\b/i, /\bsocial media\b/i] },
  { intent: "content_creation", patterns: [/\bcaption\b/i, /\bscript\b/i, /\bcontent\b/i, /\bpost\b/i, /\bvideo idea\b/i] },
  { intent: "automation", patterns: [/\bautomate\b/i, /\bautomation\b/i, /\bautomatically\b/i] },
  { intent: "va_assistant", patterns: [/\bvirtual assistant\b/i, /\bpersonal assistant\b/i, /\borganize my\b/i] }
];

export function detectIntent(input) {
  const text = String(input || "").trim();
  if (!text) return { name: "unknown", confidence: 0, text: "" };

  for (const group of PATTERNS) {
    const matches = group.patterns.filter(pattern => pattern.test(text)).length;
    if (matches > 0) {
      return { name: group.intent, confidence: Math.min(0.95, 0.55 + matches * 0.15), text };
    }
  }

  return { name: "conversation", confidence: 0.5, text };
}
