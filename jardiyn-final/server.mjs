import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { runAgent, isFallbackMode } from "./src/services/agentLoop.js";
import { publicToolRegistry } from "./src/services/tools.js";
import { executeTool, buildDashboard, normalizeGardenProfile } from "./src/services/toolHandlers.js";
import { addMemory, listMemory, addTask, listTasks, updateTask, addPlant, listPlants, saveGardenProfile, getGardenProfile, listAgentRuns, clearSession, storeSnapshot } from "./src/services/store.js";
import { handleMcpRpc, mcpCapabilities } from "./src/mcp/server.js";
import { liveApisEnabled } from "./src/services/liveApis.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 1024 * 1024 * 5;
const VERSION = "5.3.0";
const rateMap = new Map();

function requestId() { return `trace_${crypto.randomBytes(8).toString("hex")}`; }
function nowIso() { return new Date().toISOString(); }
function isProd() { return process.env.NODE_ENV === "production"; }
function json(obj) { return JSON.stringify(obj, null, isProd() ? 0 : 2); }

function securityHeaders(traceId) {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(self), microphone=(), geolocation=()",
    "x-jardiyn-trace-id": traceId,
    "content-security-policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; script-src 'self'; base-uri 'self'; form-action 'self'"
  };
}

function send(res, status, payload, traceId, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...securityHeaders(traceId), ...headers });
  res.end(json(payload));
}
function ok(res, data, traceId, status = 200, meta = {}) { send(res, status, { ok: true, trace_id: traceId, data, meta: { timestamp: nowIso(), ...meta } }, traceId); }
function fail(res, status, code, message, traceId, details) { send(res, status, { ok: false, trace_id: traceId, error: { code, message, details }, meta: { timestamp: nowIso() } }, traceId); }

function clientIp(req) { return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local").split(",")[0].trim(); }
function rateLimit(req, pathname) {
  const limit = pathname === "/api/chat" || pathname === "/api/v1/chat" ? 36 : pathname === "/mcp" ? 90 : 180;
  const windowMs = 60_000;
  const key = `${clientIp(req)}:${pathname}`;
  const now = Date.now();
  const record = rateMap.get(key) || { count: 0, reset: now + windowMs };
  if (now > record.reset) { record.count = 0; record.reset = now + windowMs; }
  record.count += 1;
  rateMap.set(key, record);
  return { allowed: record.count <= limit, remaining: Math.max(0, limit - record.count), reset: record.reset };
}

function requiresWriteAuth(method, pathname) {
  return method !== "GET" && ["/api/memory", "/api/tasks", "/api/plants", "/api/profile", "/api/session/clear"].includes(pathname);
}
function optionalWriteAuth(req) {
  const token = process.env.JARDIYN_API_TOKEN;
  if (!token) return true;
  return req.headers.authorization === `Bearer ${token}` || req.headers["x-jardiyn-token"] === token;
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("Request body too large"), { code: "BODY_TOO_LARGE" })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      const raw = Buffer.concat(chunks).toString("utf8");
      try { resolve(JSON.parse(raw)); }
      catch { reject(Object.assign(new Error("Invalid JSON body"), { code: "INVALID_JSON" })); }
    });
    req.on("error", reject);
  });
}

function sessionFrom(req, body, url) {
  return String(body.session_id || url.searchParams.get("session_id") || req.headers["x-jardiyn-session"] || "default").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "default";
}
function parseQueryProfile(url) { return Object.fromEntries(url.searchParams.entries()); }
function stripApiVersion(pathname) { return pathname.startsWith("/api/v1/") ? pathname.replace("/api/v1", "/api") : pathname; }

function sources() {
  return [
    { id: "weather.openmeteo", name: "Open-Meteo Forecast", category: "Weather", mode: liveApisEnabled() ? "live" : "fallback-disabled", endpoint: "get_weather_forecast", freshness: "current + 7 day forecast" },
    { id: "noaa.alerts", name: "NOAA / National Weather Service", category: "NOAA / NWS", mode: liveApisEnabled() ? "live adapter" : "fallback-disabled", endpoint: "get_noaa_alerts", freshness: "active alerts" },
    { id: "airquality.openmeteo", name: "Open-Meteo Air Quality", category: "Pollen", mode: liveApisEnabled() ? "live" : "fallback-disabled", endpoint: "get_pollen_forecast", freshness: "hourly forecast" },
    { id: "archive.openmeteo", name: "Open-Meteo Archive", category: "Rainfall", mode: liveApisEnabled() ? "live" : "fallback-disabled", endpoint: "get_recent_rainfall", freshness: "recent historical precipitation" },
    { id: "zip.zippopotamus", name: "Zippopotam.us", category: "Location", mode: liveApisEnabled() ? "live" : "local cache", endpoint: "get_garden_zone", freshness: "on request" },
    { id: "soil.soilgrids", name: "SoilGrids / ISRIC-ready adapter", category: "Soil", mode: "adapter-ready + profile fallback", endpoint: "get_soil_profile", freshness: "profile/current" },
    { id: "plants.openfarm.inat", name: "OpenFarm + iNaturalist-ready adapter", category: "Plants", mode: "adapter-ready + curated fallback", endpoint: "lookup_plant_database", freshness: "on request" }
  ];
}
function evaluationRubric() {
  return [
    { gate: "UX", check: "Ask JarDIYn is the primary UX and folds Weather, NOAA/NWS, Frost, Pollen, Rain/Watering, and Soil/Zone into one recommendation." },
    { gate: "API", check: "Every route returns a consistent response envelope with trace_id." },
    { gate: "Agent", check: "Fallback mode is agentic, tool-using, and keyless." },
    { gate: "Anthropic", check: "Live Anthropic path is preserved with tool use when configured." },
    { gate: "MCP", check: "JSON-RPC adapter supports tools/list, tools/call, resources/list, resources/read, prompts/list." },
    { gate: "Security", check: "Escaped frontend rendering, rate limiting, body limits, security headers, optional write token." },
    { gate: "Persistence", check: "Profiles, memory, tasks, plants, runs, and tool calls persist through a store adapter." },
    { gate: "Deploy", check: "Render root is jardiyn-final with npm install / npm start." }
  ];
}

async function handleApi(req, res, traceId) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const method = req.method || "GET";
  const pathname = stripApiVersion(url.pathname);
  const rl = rateLimit(req, pathname);
  if (!rl.allowed) return fail(res, 429, "RATE_LIMITED", "Too many requests. Please slow down and retry shortly.", traceId, { reset: rl.reset });
  if (requiresWriteAuth(method, pathname) && !optionalWriteAuth(req)) return fail(res, 401, "UNAUTHORIZED", "This write endpoint requires a JarDIYn API token.", traceId);
  let body = {};
  if (!["GET", "HEAD"].includes(method)) body = await parseBody(req);
  const session_id = sessionFrom(req, body, url);
  const savedProfile = getGardenProfile(session_id);

  if (method === "GET" && pathname === "/api/health") return ok(res, { service: "jardiyn", status: "healthy", version: VERSION }, traceId);
  if (method === "GET" && pathname === "/api/status") return ok(res, { service: "jardiyn", status: "ready", version: VERSION, env: process.env.NODE_ENV || "development", live_apis: liveApisEnabled(), anthropic_configured: Boolean(process.env.ANTHROPIC_API_KEY), fallback_agent: isFallbackMode(), persistence: "json-file-adapter", mcp: "/mcp" }, traceId);
  if (method === "GET" && pathname === "/api/tools") return ok(res, publicToolRegistry(), traceId);
  if (method === "GET" && pathname === "/api/sources") return ok(res, { sources: sources(), live_apis_enabled: liveApisEnabled() }, traceId);
  if (method === "GET" && pathname === "/api/evaluation") return ok(res, { rubric: evaluationRubric(), acceptance: "FABLE5/MYTHOS Ask-First Enterprise Gold" }, traceId);
  if (method === "GET" && pathname === "/api/mcp/capabilities") return ok(res, mcpCapabilities(), traceId);
  if (method === "GET" && pathname === "/.well-known/jardiyn.json") return ok(res, { name: "JarDIYn by GardenHub", version: VERSION, api: "/api", api_v1: "/api/v1", mcp: "/mcp", tools: "/api/tools" }, traceId);

  if (pathname === "/api/dashboard" && ["GET", "POST"].includes(method)) {
    const incoming = method === "GET" ? parseQueryProfile(url) : (body.profile || body);
    const profile = normalizeGardenProfile({ ...savedProfile, ...incoming });
    saveGardenProfile(session_id, profile);
    return ok(res, await buildDashboard(profile), traceId);
  }
  if (method === "POST" && pathname === "/api/chat") {
    if (!body.message || String(body.message).trim().length < 1) return fail(res, 400, "INVALID_MESSAGE", "Message is required.", traceId);
    const profile = normalizeGardenProfile({ ...savedProfile, ...(body.profile || {}) });
    saveGardenProfile(session_id, profile);
    return ok(res, await runAgent({ message: String(body.message).slice(0, 4000), profile, session_id, save_suggestions: body.save_suggestions === true }), traceId);
  }
  if (method === "POST" && pathname === "/api/zone") return ok(res, { result: await executeTool("get_garden_zone", body, { session_id }) }, traceId);
  if (method === "POST" && pathname === "/api/report") return ok(res, { result: await executeTool("generate_diy_report", body, { profile: body.profile || savedProfile, session_id }) }, traceId);
  if (method === "POST" && pathname === "/api/design") return ok(res, { result: await executeTool("generate_garden_plan", body, { profile: body.profile || savedProfile, session_id }) }, traceId);
  if (method === "POST" && pathname === "/api/schedule") return ok(res, { result: await executeTool("generate_garden_plan", { ...body, horizon: body.horizon || "weekend" }, { profile: body.profile || savedProfile, session_id }) }, traceId);
  if (method === "POST" && pathname === "/api/identify") return ok(res, { result: await executeTool("diagnose_plant_issue", { ...body, symptoms: body.symptoms || body.message || body.photo_context }, { profile: body.profile || savedProfile, session_id }) }, traceId);

  if (pathname === "/api/profile") {
    if (method === "GET") return ok(res, { session_id, profile: savedProfile }, traceId);
    if (method === "POST") return ok(res, { session_id, profile: saveGardenProfile(session_id, normalizeGardenProfile(body.profile || body)) }, traceId, 201);
  }
  if (pathname === "/api/memory") {
    if (method === "GET") return ok(res, { session_id, memory: listMemory(session_id) }, traceId);
    if (method === "POST") return ok(res, { session_id, item: addMemory(session_id, body) }, traceId, 201);
  }
  if (pathname === "/api/tasks") {
    if (method === "GET") return ok(res, { session_id, tasks: listTasks(session_id) }, traceId);
    if (method === "POST") return ok(res, { session_id, task: addTask(session_id, body) }, traceId, 201);
    if (method === "PATCH") return ok(res, { session_id, task: updateTask(session_id, body.id, body.patch || body) }, traceId);
  }
  if (pathname === "/api/plants") {
    if (method === "GET") return ok(res, { session_id, plants: listPlants(session_id) }, traceId);
    if (method === "POST") return ok(res, { session_id, plant: addPlant(session_id, body) }, traceId, 201);
  }
  if (method === "GET" && pathname === "/api/runs") return ok(res, { runs: listAgentRuns(40) }, traceId);
  if (method === "GET" && pathname === "/api/session") return ok(res, storeSnapshot(session_id), traceId);
  if (method === "POST" && pathname === "/api/session/clear") return ok(res, clearSession(session_id), traceId);
  if (method === "POST" && pathname === "/mcp") return send(res, 200, await handleMcpRpc(body, { session_id }), traceId);

  return fail(res, 404, "NOT_FOUND", `No route for ${method} ${pathname}`, traceId);
}

function serveStatic(req, res, traceId) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const file = path.resolve(PUBLIC_DIR, `.${pathname}`);
  if (!file.startsWith(PUBLIC_DIR)) return fail(res, 403, "FORBIDDEN", "Forbidden", traceId);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return fail(res, 404, "NOT_FOUND", "Not found", traceId);
  const type = file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".css") ? "text/css; charset=utf-8" : file.endsWith(".js") ? "text/javascript; charset=utf-8" : file.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
  res.writeHead(200, { "content-type": type, ...securityHeaders(traceId), "cache-control": isProd() && !file.endsWith(".html") ? "public, max-age=3600" : "no-cache" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const traceId = requestId();
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, { ...securityHeaders(traceId), "access-control-allow-methods": "GET,POST,PATCH,OPTIONS", "access-control-allow-headers": "content-type,authorization,x-jardiyn-session,x-jardiyn-token" });
      res.end(); return;
    }
    if (url.pathname.startsWith("/api") || url.pathname === "/mcp" || url.pathname === "/.well-known/jardiyn.json") return await handleApi(req, res, traceId);
    return serveStatic(req, res, traceId);
  } catch (error) {
    return fail(res, error.code === "BODY_TOO_LARGE" ? 413 : error.code === "INVALID_JSON" ? 400 : 500, error.code || "SERVER_ERROR", error.message || "Server error", traceId, isProd() ? undefined : { stack: error.stack });
  }
});

server.listen(PORT, () => {
  console.log(`JarDIYn FABLE5+MYTHOS Enterprise Complete → http://localhost:${PORT}`);
  console.log(`Mode: ${isFallbackMode() ? "fallback/keyless" : "anthropic-live"} | Live APIs: ${liveApisEnabled()} | Version: ${VERSION}`);
});
