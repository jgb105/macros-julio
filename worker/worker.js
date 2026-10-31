/**
 * Worker de Cloudflare para "Macros de Julio".
 * Guarda la API key de Gemini como secreto y solo atiende a tu app.
 *
 * Variables (Settings → Variables and Secrets):
 *   GEMINI_API_KEY   (Secret)  tu API key de Google AI Studio
 *   APP_TOKEN        (Secret)  una clave personal larga que inventas tú; la misma va en Ajustes de la app
 *   ALLOWED_ORIGINS  (Text)    https://TU-USUARIO.github.io   (varias separadas por coma)
 *   GEMINI_MODEL     (Text)    opcional; por defecto gemini-flash-latest
 */
const API = "https://generativelanguage.googleapis.com/v1beta";
const MAX_BODY = 12 * 1024 * 1024; // 12 MB (fotos ya vienen comprimidas desde la app)
const MAX_IMAGES = 4;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": okOrigin ? origin : (allowed[0] || "null"),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-App-Token",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!okOrigin) return json({ error: "origin", message: "Origen no permitido" }, 403);
    if (!env.APP_TOKEN || !safeEqual(req.headers.get("X-App-Token") || "", env.APP_TOKEN)) return json({ error: "token" }, 401);
    if (!env.GEMINI_API_KEY) return json({ error: "upstream", message: "Falta GEMINI_API_KEY en el Worker" }, 500);

    const url = new URL(req.url);
    const defModel = env.GEMINI_MODEL || "gemini-flash-latest";

    if (url.pathname === "/models" && req.method === "GET") {
      const r = await fetch(`${API}/models?pageSize=200`, { headers: { "x-goog-api-key": env.GEMINI_API_KEY } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: "upstream", message: d?.error?.message?.slice(0, 300) || "HTTP " + r.status }, 502);
      const models = (d.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map(m => String(m.name || "").replace(/^models\//, ""))
        .filter(n => /gemini/i.test(n));
      return json({ default: defModel, models });
    }

    if (url.pathname === "/ai" && req.method === "POST") {
      const len = Number(req.headers.get("Content-Length") || 0);
      if (len > MAX_BODY) return json({ error: "too_large" }, 413);
      let body;
      try { body = await req.json(); } catch { return json({ error: "bad_request", message: "JSON inválido" }, 400); }
      const prompt = String(body?.prompt || "").slice(0, 20000);
      if (!prompt) return json({ error: "bad_request", message: "Falta prompt" }, 400);
      const images = Array.isArray(body?.images) ? body.images.slice(0, MAX_IMAGES) : [];
      const model = /^[a-z0-9.\-]{3,80}$/i.test(String(body?.model || "")) ? body.model : defModel;

      const parts = [{ text: prompt }];
      for (const im of images) {
        const mime = /^image\/(jpeg|png|webp)$/.test(im?.mime) ? im.mime : "image/jpeg";
        if (typeof im?.data === "string" && im.data.length > 100) parts.push({ inline_data: { mime_type: mime, data: im.data } });
      }
      // Razonamiento: los modelos Gemini piensan al máximo si no se indica nada (lento).
      // Gemini 3 usa thinkingLevel; Gemini 2.5 usa thinkingBudget. Se prueba en ese orden y,
      // si el modelo rechaza la opción, se reintenta sin ella.
      const level = ["minimal", "low", "medium", "high"].includes(body?.thinking) ? body.thinking : "minimal";
      const thinkingOptions = [
        { thinkingLevel: level },
        { thinkingBudget: level === "minimal" ? 0 : level === "low" ? 1024 : -1 },
        null
      ];
      const t0 = Date.now();
      let r, d;
      for (const tc of thinkingOptions) {
        const payload = {
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.2,
            ...(body?.json !== false ? { responseMimeType: "application/json" } : {}),
            ...(tc ? { thinkingConfig: tc } : {})
          }
        };
        r = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify(payload)
        });
        d = await r.json().catch(() => ({}));
        const msg = String(d?.error?.message || "");
        if (r.status === 400 && tc && /thinking/i.test(msg)) continue; // opción no soportada por este modelo
        break;
      }
      if (!r.ok) {
        const code = r.status === 429 ? "rate_limited" : "upstream";
        return json({ error: code, message: d?.error?.message?.slice(0, 300) || "HTTP " + r.status }, r.status === 429 ? 429 : 502);
      }
      const cand = d?.candidates?.[0];
      const text = (cand?.content?.parts || []).filter(p => !p.thought).map(p => p.text || "").join("");
      if (!text) return json({ error: "blocked", message: d?.promptFeedback?.blockReason || cand?.finishReason || "Respuesta vacía" }, 502);
      return json({ text, model, ms: Date.now() - t0 });
    }

    return json({ error: "not_found" }, 404);
  }
};

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
