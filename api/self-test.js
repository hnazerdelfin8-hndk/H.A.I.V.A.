// Temporary production smoke test for H.A.I.V.A. core AI connectivity.
import { buildProviderRequest, extractProviderAnswer, MULTIBRAIN_ORDER } from "./provider-gateway.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false });

  const messages = [
    { role: "system", content: "You are H.A.I.V.A. Reply briefly and naturally." },
    { role: "user", content: "Say hello to Master in one short sentence." }
  ];

  const results = [];
  for (const providerId of MULTIBRAIN_ORDER) {
    try {
      const request = buildProviderRequest(providerId, messages, { maxTokens: 32, temperature: 0.1 });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(request.url, { method: "POST", headers: request.headers, body: request.body, signal: controller.signal });
        const text = await response.text();
        let data = null;
        try { data = JSON.parse(text); } catch {}
        const answer = extractProviderAnswer(providerId, data);
        results.push({ provider: providerId, status: response.status, ok: response.ok && Boolean(answer), response: answer || null });
        if (response.ok && answer) return res.status(200).json({ ok: true, provider: providerId, response: answer, results });
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      results.push({ provider: providerId, ok: false, error: error?.code || error?.name || "ERROR" });
    }
  }

  return res.status(503).json({ ok: false, results });
}
