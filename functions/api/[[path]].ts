export const onRequest: PagesFunction = async (context) => {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Helper to get SMM Config from Firestore REST API
  const getSmmConfig = async () => {
    const PROJECT_ID = "followers-69c83";
    const DEFAULT_API_URL = "https://app.smmowl.com/api/v2";
    const DEFAULT_API_KEY = "36006c74798b368739665893098737e6";

    try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/settings/app_config`;
      const response = await fetch(firestoreUrl);
      if (response.ok) {
        const data = await response.json() as any;
        const fields = data.fields || {};
        const config = {
          apiKey: (fields.smmApiKey?.stringValue || DEFAULT_API_KEY).trim(),
          apiUrl: (fields.smmApiUrl?.stringValue || DEFAULT_API_URL).trim()
        };
        return config;
      }
    } catch (error) {
      console.error("Error fetching SMM config from Firestore REST API:", error);
    }

    return {
      apiKey: DEFAULT_API_KEY,
      apiUrl: DEFAULT_API_URL
    };
  };

  // API Routes
  if (path === "/api/services") {
    const { apiKey, apiUrl } = await getSmmConfig();
    const body = new URLSearchParams();
    body.append('key', apiKey);
    body.append('action', 'services');

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body
    });
    return new Response(response.body, {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  if (path === "/api/order" && request.method === "POST") {
    const { apiKey, apiUrl } = await getSmmConfig();
    const reqBody = await request.json() as any;
    const body = new URLSearchParams();
    body.append('key', apiKey);
    body.append('action', 'add');
    body.append('service', String(reqBody.service));
    body.append('link', String(reqBody.link));
    body.append('quantity', String(reqBody.quantity));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body
    });
    return new Response(response.body, {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  if (path.startsWith("/api/order-status/")) {
    const id = path.split("/").pop();
    const { apiKey, apiUrl } = await getSmmConfig();
    const body = new URLSearchParams();
    body.append('key', apiKey);
    body.append('action', 'status');
    body.append('order', String(id));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body
    });
    return new Response(response.body, {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  if (path === "/api/balance") {
    const { apiKey, apiUrl } = await getSmmConfig();
    const body = new URLSearchParams();
    body.append('key', apiKey);
    body.append('action', 'balance');

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body
    });
    return new Response(response.body, {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  if (path === "/api/health") {
    return new Response(JSON.stringify({ status: "ok", message: "Cloudflare Function is running" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Fallback for other /api routes
  if (path.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "API Route not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  // If it's not an API route, let Cloudflare Pages handle it (serve static files)
  return context.next();
};
