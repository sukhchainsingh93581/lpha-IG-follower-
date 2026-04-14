import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import admin from "firebase-admin";
import cron from "node-cron";

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

// Initialize Firebase Admin for background tasks
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

// Chat Cleanup Task: Deletes messages older than 7 days
const cleanupChat = async () => {
  console.log("[Cron] Starting chat cleanup...");
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  try {
    const chatRef = admin.firestore().collection("global_chat");
    const snapshot = await chatRef.where("createdAt", "<", admin.firestore.Timestamp.fromDate(sevenDaysAgo)).get();
    
    if (snapshot.empty) {
      console.log("[Cron] No old messages to delete.");
      return;
    }

    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`[Cron] Deleted ${snapshot.size} old messages.`);
  } catch (error) {
    console.error("[Cron] Error cleaning up chat:", error);
  }
};

// Schedule cleanup to run every day at midnight (00:00)
// This ensures a rolling 7-day history as requested
cron.schedule("0 0 * * *", cleanupChat);

// Order Status Sync Task: Syncs Pending/Processing orders with SMM API
const syncOrderStatuses = async () => {
  console.log("[Cron] Starting order status sync...");
  try {
    const ordersRef = admin.firestore().collection("orders");
    // Limit to 50 orders per run to avoid hitting burst quotas
    const snapshot = await ordersRef
      .where("status", "in", ["Pending", "Processing"])
      .limit(50)
      .get();
    
    if (snapshot.empty) {
      console.log("[Cron] No active orders to sync.");
      return;
    }

    console.log(`[Cron] Syncing ${snapshot.size} orders...`);
    
    // Get SMM Config (we'll need a way to get this in the cron job)
    // Since we're in the server, we can fetch it from Firestore directly
    const configDoc = await admin.firestore().collection("settings").doc("app_config").get();
    const configData = configDoc.exists ? configDoc.data() : {};
    
    const DEFAULT_API_URL = "https://app.smmowl.com/api/v2";
    const DEFAULT_API_KEY = "36006c74798b368739665893098737e6"; 
    
    const apiKey = (configData?.smmApiKey || process.env.SMM_API_KEY || DEFAULT_API_KEY).trim();
    const apiUrl = (configData?.smmApiUrl || process.env.SMM_API_URL || DEFAULT_API_URL).trim();

    const getSmmHeaders = (url: string) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
      };
      
      try {
        const origin = new URL(url).origin;
        headers["Origin"] = origin;
        headers["Referer"] = origin + "/";
      } catch (e) {
        // Fallback if URL is invalid
      }
      return headers;
    };

    for (const orderDoc of snapshot.docs) {
      const order = orderDoc.data();
      const apiOrderId = order.api_order_id;
      
      if (!apiOrderId) continue;

      try {
        const params = new URLSearchParams();
        params.append('key', apiKey);
        params.append('action', 'status');
        params.append('order', String(apiOrderId));

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: getSmmHeaders(apiUrl),
          body: params.toString(),
        });

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json() as any;
          console.log(`[Cron] API Response for Order ${apiOrderId}:`, JSON.stringify(data));
          if (data.status) {
            let apiStatus = String(data.status).toLowerCase();
            let newStatus = order.status;

            if (apiStatus.includes('pending')) {
              newStatus = 'Pending';
            } else if (apiStatus.includes('processing') || apiStatus.includes('progress') || apiStatus.includes('active')) {
              newStatus = 'Processing';
            } else if (apiStatus.includes('completed') || apiStatus.includes('success') || apiStatus.includes('done') || apiStatus.includes('finish')) {
              newStatus = 'Completed';
            } else if (apiStatus.includes('cancel') || apiStatus.includes('partial') || apiStatus.includes('refund') || apiStatus.includes('fail')) {
              newStatus = 'Cancelled';
            }

            if (newStatus !== order.status) {
              await orderDoc.ref.update({
                status: newStatus,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log(`[Cron] Updated Order ${orderDoc.id} status from ${order.status} to ${newStatus} (API: ${data.status})`);
            }
          }
        }
        // Add a small delay (200ms) between orders to avoid hitting write rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`[Cron] Error syncing order ${orderDoc.id}:`, err);
      }
    }
  } catch (error: any) {
    if (error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('Quota exceeded')) {
      console.warn("[Cron] Firestore daily quota reached. Skipping sync until tomorrow.");
    } else {
      console.error("[Cron] Error in order status sync:", error);
    }
  }
};

// Schedule order sync to run every 5 minutes
cron.schedule("*/5 * * * *", syncOrderStatuses);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors({ origin: "*" }));
  app.use(express.json());

  // Helper to get SMM Config from Firestore
  const getSmmConfig = async () => {
    // HARDCODED FALLBACKS - Update these if needed
    const DEFAULT_API_URL = "https://app.smmowl.com/api/v2";
    const DEFAULT_API_KEY = "36006c74798b368739665893098737e6"; 

    try {
      const configDoc = await getDoc(doc(db, 'settings', 'app_config'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        const config = {
          apiKey: (data.smmApiKey || process.env.SMM_API_KEY || DEFAULT_API_KEY).trim(),
          apiUrl: (data.smmApiUrl || process.env.SMM_API_URL || DEFAULT_API_URL).trim()
        };
        console.log(`[SMM Config] Using URL: ${config.apiUrl} (Key: ${config.apiKey.substring(0, 4)}***)`);
        return config;
      }
    } catch (error) {
      console.error("Error fetching SMM config from Firestore:", error);
    }
    
    const fallbackConfig = {
      apiKey: (process.env.SMM_API_KEY || DEFAULT_API_KEY).trim(),
      apiUrl: (process.env.SMM_API_URL || DEFAULT_API_URL).trim()
    };
    console.log(`[SMM Config] Using Fallback URL: ${fallbackConfig.apiUrl} (Key: ${fallbackConfig.apiKey.substring(0, 4)}***)`);
    return fallbackConfig;
  };

  const getSmmHeaders = (url: string) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
    };
    
    try {
      const origin = new URL(url).origin;
      headers["Origin"] = origin;
      headers["Referer"] = origin + "/";
    } catch (e) {
      // Fallback if URL is invalid
    }
    return headers;
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

      console.log(`[API] Fetching services from: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: getSmmHeaders(apiUrl),
        body: params.toString(),
      });
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error(`Non-JSON response from SMM API (${response.status}):`, text.substring(0, 200));
        
        let errorMessage = `SMM API returned an invalid response (Status: ${response.status}).`;
        if (response.status === 403) {
          errorMessage += " This is a 403 Forbidden error. Please check if your API Key is correct and if your SMM Panel has 'IP Restriction' enabled. You may need to disable IP restriction in your SMM Panel settings.";
        } else {
          errorMessage += " Check your API URL and Key in Admin Panel.";
        }

        return res.status(500).json({ 
          error: errorMessage,
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
      res.status(500).json({ error: `Connection Error: ${error.message}. Please check your API URL.` });
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

      console.log(`[API] Placing order to: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: getSmmHeaders(apiUrl),
        body: params.toString(),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error(`Non-JSON response from SMM API (${apiUrl}):`, text.substring(0, 200));
        
        let errorMessage = `SMM API Error (Status: ${response.status}) from ${apiUrl}. The API did not return JSON.`;
        if (response.status === 403) {
          errorMessage = "403 Forbidden: Your SMM Panel blocked the request. Please disable 'IP Restriction' in your SMM Panel settings or check your API Key.";
        }

        return res.status(500).json({ 
          error: errorMessage,
          details: text.substring(0, 100)
        });
      }

      const data = await response.json() as any;
      if (!response.ok) {
        return res.status(response.status).json({ 
          error: data.error || `SMM API Error: ${response.status} from ${apiUrl}`,
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
        headers: getSmmHeaders(apiUrl),
        body: params.toString(),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response from SMM API (status):", text.substring(0, 200));
        return res.status(500).json({ error: `SMM API returned an invalid response (Status: ${response.status}).` });
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

  app.post("/api/refill", async (req, res) => {
    const { apiKey, apiUrl } = await getSmmConfig();
    if (!apiKey) {
      return res.status(400).json({ error: "SMM API Key is missing." });
    }
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required." });
    }

    try {
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('action', 'refill');
      params.append('order', String(orderId));

      console.log(`[API] Sending refill request for order: ${orderId} to: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: getSmmHeaders(apiUrl),
        body: params.toString(),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error(`Non-JSON response from SMM API (${response.status}):`, text.substring(0, 200));
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
      console.error("Error sending refill request:", error);
      res.status(500).json({ error: `Connection Error: ${error.message}` });
    }
  });

  app.get("/api/balance", async (req, res) => {
    const { apiKey, apiUrl } = await getSmmConfig();
    if (!apiKey) {
      return res.status(400).json({ error: "SMM API Key is missing." });
    }
    try {
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('action', 'balance');

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: getSmmHeaders(apiUrl),
        body: params.toString(),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response from SMM API (balance):", text.substring(0, 200));
        
        let errorMessage = `SMM API returned an invalid response (Status: ${response.status}).`;
        if (response.status === 403) {
          errorMessage = "403 Forbidden: Please check your API Key and disable 'IP Restriction' in your SMM Panel settings.";
        }

        return res.status(500).json({ error: errorMessage });
      }

      const data = await response.json() as any;
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: `Connection Error: ${error.message}` });
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
