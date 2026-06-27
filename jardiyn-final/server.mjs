import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { runGardenAgent } from "./src/services/agentLoop.js";
import { publicToolRegistry } from "./src/services/tools.js";
import { saveProfile, loadProfile, saveTurn, loadHistory, PERSISTENCE_MODE, sessionCount } from "./src/services/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = "3.0.0";
const startedAt = Date.now();

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cache-Control", req.path.startsWith("/api") ? "no-store" : "public, max-age=1800");
  next();
});
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const buckets = new Map();
app.use("/api", (req, res, next) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = buckets.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 60_000;
  }
  bucket.count += 1;
  buckets.set(ip, bucket);
  if (bucket.count > 90) return res.status(429).json({ error: "Too many requests. Try again in a minute." });
  next();
});

function publicHealth() {
  return {
    status: "ok",
    app: "JarDIYn by GardenHub",
    version: VERSION,
    timestamp: new Date().toISOString()
  };
}

function debugStatus() {
  return {
    ...publicHealth(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    llmProvider: process.env.ANTHROPIC_API_KEY ? "configured" : "not configured — transparent fallback mode active",
    modelConfigured: Boolean(process.env.ANTHROPIC_MODEL),
    liveApisEnabled: process.env.LIVE_APIS !== "false",
    persistence: PERSISTENCE_MODE,
    sessionsInMemory: sessionCount(),
    toolsRegistered: publicToolRegistry().length,
    debugSafety: "sanitized; no secrets, raw prompts, private property data, or stack traces exposed"
  };
}

app.get("/api/health", (_req, res) => res.json(publicHealth()));
app.get("/health", (_req, res) => res.json(publicHealth()));

app.get("/api/debug/status", (_req, res) => {
  if (process.env.ENABLE_DEBUG_ROUTES === "false" && process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "debug disabled" });
  }
  res.json(debugStatus());
});

app.get("/api/tools", (_req, res) => {
  res.json({ tools: publicToolRegistry(), count: publicToolRegistry().length, timestamp: new Date().toISOString() });
});

app.get("/api/sources", (_req, res) => {
  res.json({
    sources: [
      { name: "Garden Passport", status: "user-provided", live: true, privacy: "client-owned; sent only with requests" },
      { name: "ZIP geocoding", status: "live-or-fallback", live: process.env.LIVE_APIS !== "false" },
      { name: "Open-Meteo weather", status: "live-or-fallback", live: process.env.LIVE_APIS !== "false" },
      { name: "SoilGrids soil context", status: "live-or-fallback", live: process.env.LIVE_APIS !== "false" },
      { name: "JarDIYn curated plant cache", status: "curated-fallback", live: true },
      { name: "Property GIS / satellite / drone", status: "future-roadmap-not-live", live: false }
    ],
    timestamp: new Date().toISOString()
  });
});

app.get("/api/evaluation", (_req, res) => {
  res.json({
    status: "ready",
    tests: [
      "health endpoint returns safe public status",
      "debug endpoint returns sanitized status only",
      "Garden Passport is accepted by /api/chat",
      "Plan Check returns risk/next-action sections",
      "Garden Plan returns site/plant/avoid/shopping/pro sections",
      "future GIS requests are clearly labeled roadmap-only",
      "no secrets or raw environment values exposed"
    ],
    command: "npm test"
  });
});

app.get("/api/history/:sessionId", (req, res) => {
  res.json({ profile: loadProfile(req.params.sessionId), history: loadHistory(req.params.sessionId, 20) });
});

app.post("/api/garden-profile", (req, res) => {
  const { session_id, garden_profile } = req.body || {};
  if (!session_id || !garden_profile) return res.status(400).json({ error: "session_id and garden_profile required" });
  saveProfile(session_id, garden_profile);
  res.json({ saved: true, persistence: PERSISTENCE_MODE, profile: loadProfile(session_id), timestamp: new Date().toISOString() });
});

app.post("/api/chat", async (req, res) => {
  const { message, garden_profile, history = [], session_id } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: "message is required" });
  try {
    if (session_id && garden_profile) saveProfile(session_id, garden_profile);
    const storedHistory = session_id ? loadHistory(session_id, 8).map(h => ({ role: h.role, content: h.content })) : [];
    const result = await runGardenAgent(String(message), garden_profile || loadProfile(session_id) || null, history.length ? history : storedHistory, {});
    if (session_id) {
      saveTurn(session_id, "user", message, { requestId: result.requestId });
      saveTurn(session_id, "assistant", result.answer, {
        requestId: result.requestId,
        toolsUsed: result.toolsUsed,
        sourcesUsed: result.sourcesUsed,
        mode: result.mode
      });
    }
    res.json(result);
  } catch (error) {
    console.error("/api/chat safe error", error);
    res.status(500).json({ error: "JarDIYn could not complete that request safely.", requestId: `err_${Date.now().toString(36)}` });
  }
});

app.post("/api/report", async (req, res) => {
  const garden_profile = req.body?.garden_profile;
  const result = await runGardenAgent("Generate a complete Garden Plan report with shopping list and professional cautions.", garden_profile, [], {});
  res.json(result);
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`JarDIYn running on port ${PORT}`);
  console.log(`Public health: /api/health`);
  console.log(`LLM: ${process.env.ANTHROPIC_API_KEY ? "configured" : "fallback mode"}`);
});

export default app;
