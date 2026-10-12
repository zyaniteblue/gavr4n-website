const json = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/contact") {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") {
      return json(
        { error: "Method not allowed" },
        405,
        { Allow: "POST" }
      );
    }

    if (!env.CONTACT_KV) {
      return json(
        { error: "Contact service unavailable" },
        503
      );
    }

    const type = request.headers.get("content-type") || "";

    if (!type.toLowerCase().includes("application/json")) {
      return json({ error: "JSON required" }, 415);
    }

    const length = Number(
      request.headers.get("content-length") || 0
    );

    if (length > 10000) {
      return json({ error: "Request too large" }, 413);
    }

    let data;

    try {
      const body = await request.text();

      if (body.length > 10000) {
        return json({ error: "Request too large" }, 413);
      }

      data = JSON.parse(body);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    if (!data || typeof data !== "object" ||
        Array.isArray(data)) {
      return json({ error: "Invalid data" }, 400);
    }

    // Unsichtbares Formularfeld gegen einfache Bots
    if (data.website) {
      return json({ success: true });
    }

    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    const message = String(data.message || "").trim();

    if (
      !name || name.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      !message || message.length > 5000
    ) {
      return json(
        { error: "Please check your details" },
        400
      );
    }

    // Einfache Begrenzung pro IP-Adresse
    const ip = request.headers.get("CF-Connecting-IP");

    if (!ip) {
      return json({ error: "Request unavailable" }, 503);
    }

    try {
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(ip)
      );

      const hash = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      const hour = Math.floor(Date.now() / 3600000);
      const rateKey = `rate:${hash}:${hour}`;

      const current = Number(
        await env.CONTACT_KV.get(rateKey) || 0
      );

      if (current >= 3) {
        return json(
          { error: "Too many requests. Try again later." },
          429,
          { "Retry-After": "3600" }
        );
      }

      const id = crypto.randomUUID();

      await env.CONTACT_KV.put(
        `contact:${Date.now()}:${id}`,
        JSON.stringify({
          id,
          name,
          email,
          message,
          createdAt: new Date().toISOString()
        }),
        { expirationTtl: 60 * 60 * 24 * 90 }
      );

      await env.CONTACT_KV.put(
        rateKey,
        String(current + 1),
        { expirationTtl: 7200 }
      );

      return json({ success: true });
    } catch {
      return json(
        { error: "Could not save message" },
        503
      );
    }
  }
};
