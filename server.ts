import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const API_KEY = process.env.SMM_API_KEY || "";
  const API_URL = process.env.SMM_API_URL || "https://app.smmowl.com/api/v2";

  // API Routes
  app.get("/api/services", async (req, res) => {
    if (!API_KEY) {
      return res.status(400).json({ error: "SMM API Key is missing. Please set SMM_API_KEY in your environment variables." });
    }
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: API_KEY,
          action: "services",
        }),
      });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response from SMM API:", text);
        return res.status(500).json({ error: "SMM API returned an invalid response (not JSON). Check your API URL and Key." });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/order", async (req, res) => {
    if (!API_KEY) {
      return res.status(400).json({ error: "SMM API Key is missing." });
    }
    const { service, link, quantity } = req.body;
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: API_KEY,
          action: "add",
          service,
          link,
          quantity,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response from SMM API (order):", text);
        return res.status(500).json({ error: "SMM API returned an invalid response." });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error placing order:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/order-status/:id", async (req, res) => {
    if (!API_KEY) {
      return res.status(400).json({ error: "SMM API Key is missing." });
    }
    const { id } = req.params;
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: API_KEY,
          action: "status",
          order: id,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response from SMM API (status):", text);
        return res.status(500).json({ error: "SMM API returned an invalid response." });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching order status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
