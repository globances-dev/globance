import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import webhookRoutes from "./routes/webhook";
import packageRoutes from "./routes/packages";
import miningRoutes from "./routes/mining";
import p2pRoutes from "./routes/p2p";
import adminRoutes from "./routes/admin";
import adminDbRoutes from "./routes/admin-db";
import settingsRoutes from "./routes/settings";
import debugRoutes from "./routes/debug";
import activityRoutes from "./routes/activity";
import { initializeScheduler } from "./utils/scheduler";
import { initializeDatabaseTables } from "./utils/db-init";

const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "JWT_SECRET",
  "CRON_SECRET",
];

function logMissingEnvironmentVariables() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(
      "[Server] Missing environment variables:",
      missing.join(", ")
    );
    console.warn(
      "[Server] Ensure Supabase and auth configuration values are set before production use."
    );
  }
}

export function createServer() {
  console.log("[Server] Creating Express server...");
  logMissingEnvironmentVariables();
  const app = express();

  // Initialize database tables on startup (non-blocking)
  initializeDatabaseTables().catch((error: any) => {
    console.error("[Server] Database initialization error:", error.message);
  });

  // Initialize internal cron scheduler for mining payouts
  try {
    initializeScheduler();
  } catch (error: any) {
    console.error("[Server] Failed to initialize scheduler:", error.message);
  }

  // Middleware
  app.use(cors());

  // Handle Buffer bodies from serverless-http BEFORE express.json()
  app.use((req: any, res, next) => {
    if (req.body && Buffer.isBuffer(req.body)) {
      try {
        const jsonString = req.body.toString("utf-8");
        req.body = JSON.parse(jsonString);
        console.log("[Server] Converted Buffer to JSON:", req.body);
      } catch (err) {
        console.error("[Server] Failed to parse Buffer body:", err);
      }
    }
    next();
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Global error handler middleware
  app.use((err: any, req: any, res: any, next: any) => {
    if (err) {
      console.error("[Server] Middleware error:", err.message);
      return res
        .status(500)
        .json({ error: "Server initialization error: " + err.message });
    }
    next();
  });

  // Request logging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoints - MUST come first and not require auth
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "pong";
    res.json({ message: ping, status: "healthy" });
  });

  // Simple health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      env: process.env.ENVIRONMENT || "unknown",
    });
  });

  app.get("/api/demo", handleDemo);

  // Authentication routes
  app.use("/api/auth", authRoutes);

  // Wallet and deposit routes
  app.use("/api/wallet", walletRoutes);

  // Webhook routes (NO auth required - must verify signature)
  app.use("/api/webhook", webhookRoutes);

  // Cloud mining packages routes
  app.use("/api/packages", packageRoutes);

  // Mining/cron routes
  app.use("/api/mining", miningRoutes);

  // P2P marketplace routes (includes fiat, payment-methods, offers, trades, chat, admin/stats)
  app.use("/api/p2p", p2pRoutes);

  // Admin routes (auth required + admin role check)
  app.use("/api/admin", adminRoutes);

  // Admin database management (production database access)
  app.use("/api/admin/db", adminDbRoutes);

  // Settings routes (public read, admin write)
  app.use("/api/settings", settingsRoutes);

  // Activity routes (user activity feed and notifications)
  app.use("/api/activity", activityRoutes);

  // Debug routes (ONLY in staging/development)
  if (
    process.env.ENVIRONMENT === "staging" ||
    process.env.DEBUG_MODE === "true"
  ) {
    console.log("🔧 Debug routes enabled");
    app.use("/api/debug", debugRoutes);
  }

  // 404 handler - only for API routes, let other routes pass through to Vite
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ error: "API endpoint not found" });
    } else {
      next();
    }
  });

  // Global error handler - MUST be last
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("[Server] Unhandled error:", err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal server error";
    res.status(status).json({ error: message });
  });

  return app;
}
