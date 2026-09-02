// =========================================
// H.A.I.V.A. SKILL — WEATHER
// =========================================

export async function weather(command) {
  const response = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: "weather", query: command })
  });

  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "Weather request failed.");
  return data.response;
}
