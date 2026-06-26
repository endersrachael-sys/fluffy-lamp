/**
 * JarDIYn — Full-Stack Server
 * ============================
 * Serves the frontend (GET /) AND all API endpoints.
 * One process, one PORT, one deployment URL.
 *
 * Run:   node server.mjs
 * Env:   ANTHROPIC_API_KEY=sk-ant-...
 */

import express    from "express";
import path       from "path";
import { fileURLToPath } from "url";
import { runGardenAgent } from "./src/services/agentLoop.js";
import { saveProfile, loadProfile, saveTurn, loadHistory, PERSISTENCE_MODE } from "./src/services/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ── Request logger ─────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (req.path.startsWith("/api"))
    console.log(`[${new Date().toISOString().slice(11,19)}] ${req.method} ${req.path}`);
  next();
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "2.1.0",
    mode: process.env.NODE_ENV || "sandbox",
    live_apis: process.env.LIVE_APIS === "true",
    persistence: PERSISTENCE_MODE
  });
});

// ── GET /api/history/:sessionId — retrieve saved garden + history ────────────
app.get("/api/history/:sessionId", (req, res) => {
  const sid = req.params.sessionId;
  res.json({
    profile: loadProfile(sid),
    history: loadHistory(sid, 30)
  });
});

// ── POST /api/chat ──────────────────────────────────────────────────────────
// Primary endpoint used by the frontend.
// Accepts a message + garden profile, returns agent response + trace.
app.post("/api/chat", async (req, res) => {
  const { message, garden_profile, history = [], session_id } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message is required" });

  try {
    // Persist the profile for this session (so it survives refresh)
    if (session_id && garden_profile) saveProfile(session_id, garden_profile);

    // Use stored history if the client didn't send any but we have a session
    const convoHistory = history.length > 0
      ? history
      : (session_id ? loadHistory(session_id).map(h => ({ role: h.role, content: h.content })) : []);

    const result = await runGardenAgent(message, garden_profile || null, convoHistory, { traceLog: true });

    // Save this turn to persistent history
    if (session_id) {
      saveTurn(session_id, "user", message, []);
      saveTurn(session_id, "assistant", result.response, result.toolsUsed || []);
    }

    res.json(result);
  } catch (err) {
    console.error("[api/chat error]", err.message);
    res.status(500).json({ error: "Agent error — check your ANTHROPIC_API_KEY", detail: err.message });
  }
});

// ── POST /api/identify ──────────────────────────────────────────────────────
app.post("/api/identify", async (req, res) => {
  const { symptom_description, image_base64, garden_profile } = req.body;
  if (!symptom_description && !image_base64)
    return res.status(400).json({ error: "Provide symptom_description or image_base64" });

  const userContent = image_base64
    ? [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image_base64 } },
       { type: "text",  text: symptom_description || "Identify this plant issue." }]
    : `Diagnose this garden problem: ${symptom_description}`;

  try {
    const result = await runGardenAgent(userContent, garden_profile || null, [], { traceLog: true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/report ────────────────────────────────────────────────────────
app.post("/api/report", async (req, res) => {
  const { garden_profile } = req.body;
  if (!garden_profile) return res.status(400).json({ error: "garden_profile required" });

  try {
    const result = await runGardenAgent(
      `Generate a complete monthly DIY garden report for month ${new Date().getMonth() + 1}. Include current weather if coordinates are available.`,
      garden_profile, [], { traceLog: true }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/zone ──────────────────────────────────────────────────────────
app.post("/api/zone", async (req, res) => {
  const { zip_code, latitude, longitude, garden_profile } = req.body;
  if (!zip_code && !(latitude && longitude))
    return res.status(400).json({ error: "Provide zip_code or latitude+longitude" });

  const loc = zip_code ? `ZIP ${zip_code}` : `${latitude}, ${longitude}`;
  try {
    const result = await runGardenAgent(
      `Look up the USDA hardiness zone and frost dates for ${loc}. Include microclimate notes.`,
      garden_profile || null, [], { traceLog: true }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/design ────────────────────────────────────────────────────────
app.post("/api/design", async (req, res) => {
  const { garden_profile, design_goals } = req.body;
  if (!garden_profile) return res.status(400).json({ error: "garden_profile required" });

  try {
    const result = await runGardenAgent(
      `Create a 2D garden design plan with a zone-appropriate plant palette.${design_goals ? ` Goals: ${design_goals}` : ""} Look up plants compatible with this profile.`,
      garden_profile, [], { traceLog: true }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/schedule ──────────────────────────────────────────────────────
app.post("/api/schedule", async (req, res) => {
  const { garden_profile, latitude, longitude } = req.body;
  if (!garden_profile) return res.status(400).json({ error: "garden_profile required" });

  const locNote = latitude ? ` Use weather data for ${latitude},${longitude}.` : "";
  try {
    const result = await runGardenAgent(
      `Generate a 7-day watering and care schedule.${locNote} Check the weather forecast before recommending.`,
      garden_profile, [], { traceLog: true }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/status — full diagnostic endpoint ──────────────────────────────
app.get("/api/status", async (req, res) => {
  const status = {
    timestamp: new Date().toISOString(),
    server: { ok: true, version: "2.1.0", uptime_seconds: Math.floor(process.uptime()) },
    environment: {
      node_env: process.env.NODE_ENV || "not set",
      live_apis: process.env.LIVE_APIS === "true",
      api_key_set: !!process.env.ANTHROPIC_API_KEY,
      node_version: process.version
    },
    persistence: { ok: false, mode: PERSISTENCE_MODE },
    anthropic: { ok: false, error: null },
    tools: { ok: false, count: 0 }
  };
  try {
    saveProfile("_status_check_", { test: true });
    status.persistence.ok = !!loadProfile("_status_check_");
  } catch (e) { status.persistence.error = e.message; }
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const r = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 10,
      messages: [{ role: "user", content: "say ok" }]
    });
    status.anthropic.ok = r.content?.[0]?.text?.length > 0;
  } catch (e) { status.anthropic.error = e.message?.slice(0, 120); }
  try {
    const { dispatchTool } = await import("./src/services/toolHandlers.js");
    const r = await dispatchTool("get_garden_zone", { zip_code: "20770" });
    status.tools.ok = !!r.hardiness_zone;
    status.tools.count = 7;
    status.tools.sample = { zip: "20770", zone: r.hardiness_zone, mode: r.mode || r.provenance?.mode };
  } catch (e) { status.tools.error = e.message; }
  status.overall_ok = status.server.ok && status.environment.api_key_set &&
                      status.persistence.ok && status.anthropic.ok && status.tools.ok;
  res.status(status.overall_ok ? 200 : 503).json(status);
});

// ── Frontend SPA fallback ────────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\nJarDIYn running → http://localhost:${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || "sandbox"}`);
  console.log(`API key: ${process.env.ANTHROPIC_API_KEY ? "SET ✓" : "MISSING ✗"}\n`);
});

export default app;


