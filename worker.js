export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405, headers: { Allow: "POST" } }
        );
      }

      try {
        const type = request.headers.get("content-type") || "";

        if (!type.toLowerCase().includes("application/json")) {
          return Response.json(
            { error: "JSON required" },
            { status: 415 }
          );
        }

        const body = await request.text();

        if (body.length > 10000) {
          return Response.json(
            { error: "Request too large" },
            { status: 413 }
          );
        }

        const data = JSON.parse(body);

        const name = String(data.name || "").trim();
        const email = String(data.email || "").trim();
        const message = String(data.message || "").trim();
        const website = String(data.website || "").trim();

        // Honeypot gegen einfache Spam-Bots
        if (website) {
          return Response.json({ success: true });
        }

        if (
          !name || name.length > 100 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          email.length > 254 ||
          !message || message.length > 5000
        ) {
          return Response.json(
            { error: "Invalid contact details" },
            { status: 400 }
          );
        }

        if (!env.CONTACT_KV) {
          return Response.json(
            { error: "Contact storage unavailable" },
            { status: 503 }
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
          })
        );

        return Response.json({ success: true });
      } catch (error) {
        return Response.json(
          { error: "Could not process contact request" },
          { status: 400 }
        );
      }
    }

    // Bestehende GAVR4N-Webseite unverändert ausliefern
    return env.ASSETS.fetch(request);
  }
};
