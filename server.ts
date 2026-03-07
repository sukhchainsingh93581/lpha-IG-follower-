import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase Config for Server
const firebaseConfig = {
  apiKey: "AIzaSyCYDiFOX0UOCqTKfSUzbmSpuRcLP63z-3o",
  authDomain: "followers-69c83.firebaseapp.com",
  databaseURL: "https://followers-69c83-default-rtdb.firebaseio.com",
  projectId: "followers-69c83",
  storageBucket: "followers-69c83.firebasestorage.app",
  messagingSenderId: "299874289642",
  appId: "1:299874289642:web:022c05f049baab1c355493"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors({ origin: "*" }));
  app.use(express.json());

  // Helper to get SMM Config from Firestore
  const getSmmConfig = async () => {
    // HARDCODED FALLBACKS - Update these if needed
    const DEFAULT_API_URL = "https://app.smmowl.com/api/v2";
    const DEFAULT_API_KEY = "36006c74798b368739665893098737e6"; // Example key from common SMM Owl setups, user should replace

    try {
      const configDoc = await getDoc(doc(db, 'settings', 'app_config'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        return {
          apiKey: (data.smmApiKey || process.env.SMM_API_KEY || DEFAULT_API_KEY).trim(),
          apiUrl: (data.smmApiUrl || process.env.SMM_API_URL || DEFAULT_API_URL).trim()
        };
      }
    } catch (error) {
      console.error("Error fetching SMM config from Firestore:", error);
    }
    return {
      apiKey: (process.env.SMM_API_KEY || DEFAULT_API_KEY).trim(),
      apiUrl: (process.env.SMM_API_URL || DEFAULT_API_URL).trim()
    };
  };

  // API Routes
  app.get("/api/services", async (req, res) => {
    const { apiKey, apiUrl } = await getSmmConfig();
    if (!apiKey) {
      return res.status(400).json({ error: "SMM API Key is missing. Please set it in Admin Panel > App Management." });
    }
    try {
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('action', 'services');

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SMM-Reseller-App/1.0"
        },
        body: params,
      });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response from SMM API:", text);
        return res.status(500).json({ 
          error: `SMM API returned an invalid response (Status: ${response.status}). Check your API URL and Key in Admin Panel.`,
          details: text.substring(0, 100)
        });
      }

      const data = await response.json() as any;
      if (!response.ok) {
        return res.status(response.status).json({ 
          error: data.error || `SMM API Error: ${response.status}`,
          details: data
        });
      }
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: `Connection Error: ${error.message}` });
    }
  });

  app.post("/api/order", async (req, res) => {
    const { apiKey, apiUrl } = await getSmmConfig();
    if (!apiKey) {
      return res.status(400).json({ error: "SMM API Key is missing. Please set it in Admin Panel." });
    }
    const { service, link, quantity } = req.body;
    try {
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('action', 'add');
      params.append('service', String(service));
      params.append('link', String(link));
      params.append('quantity', String(quantity));

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SMM-Reseller-App/1.0"
        },
        body: params,
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response from SMM API (order):", text);
        return res.status(500).json({ 
          error: `SMM API Error (Status: ${response.status}). The API did not return JSON.`,
          details: text.substring(0, 100)
        });
      }

      const data = await response.json() as any;
      if (!response.ok) {
        return res.status(response.status).json({ 
          error: data.error || `SMM API Error: ${response.status}`,
          details: data
        });
      }
      res.json(data);
    } catch (error: any) {
      console.error("Error placing order:", error);
      res.status(500).json({ error: `Connection Error: ${error.message}` });
    }
  });

  app.get("/api/order-status/:id", async (req, res) => {
    const { apiKey, apiUrl } = await getSmmConfig();
    if (!apiKey) {
      return res.status(400).json({ error: "SMM API Key is missing." });
    }
    const { id } = req.params;
    try {
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('action', 'status');
      params.append('order', String(id));

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SMM-Reseller-App/1.0"
        },
        body: params,
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response from SMM API (status):", text);
        return res.status(500).json({ error: "SMM API returned an invalid response." });
      }

      const data = await response.json() as any;
      if (!response.ok) {
        return res.status(response.status).json({ 
          error: data.error || `SMM API Error: ${response.status}`,
          details: data
        });
      }
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching order status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Health check and 404 handler for API
  app.get("/api/health", (req, res) => res.json({ status: "ok", message: "Backend is running" }));
  
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API Route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
