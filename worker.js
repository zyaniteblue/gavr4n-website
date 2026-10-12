export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Später: Kontaktformular und E-Mail-Bestätigung
    if (url.pathname === "/api/contact") {
      return Response.json(
        { error: "Contact form not configured yet." },
        { status: 503 }
      );
    }

    // Bestehende GAVR4N-Webseite ausliefern
    return env.ASSETS.fetch(request);
  }
};
