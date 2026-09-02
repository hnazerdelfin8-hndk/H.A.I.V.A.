// =========================================
// H.A.I.V.A. SKILL — WEB SEARCH
// =========================================

export async function webSearch(command) {
  const response = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: "web_search", query: command })
  });

  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "Web search failed.");
  return data.response;
}
