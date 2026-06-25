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
  res.json({ status: "ok", version: "2.0.0", mode: process.env.NODE_ENV || "sandbox" });
});

// ── POST /api/chat ──────────────────────────────────────────────────────────
// Primary endpoint used by the frontend.
// Accepts a message + garden profile, returns agent response + trace.
app.post("/api/chat", async (req, res) => {
  const { message, garden_profile, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message is required" });

  try {
    const result = await runGardenAgent(message, garden_profile || null, history, { traceLog: true });
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
