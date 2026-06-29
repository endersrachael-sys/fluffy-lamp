import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../.data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

function blank() {
  return { version: "5.3", profiles: {}, memory: {}, tasks: {}, plants: {}, agent_runs: [], tool_calls: [], audit: [] };
}

function ensureDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function readStore() {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return blank();
  try { return { ...blank(), ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) }; }
  catch { return blank(); }
}
function writeStore(data) {
  ensureDir();
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
function id(prefix) { return `${prefix}_${crypto.randomBytes(6).toString("hex")}`; }
function now() { return new Date().toISOString(); }
export function normalizeSession(sessionId) { return String(sessionId || "default").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "default"; }

export function getGardenProfile(sessionId = "default") { return readStore().profiles[normalizeSession(sessionId)] || {}; }
export function saveGardenProfile(sessionId = "default", profile = {}) {
  const db = readStore();
  const sid = normalizeSession(sessionId);
  db.profiles[sid] = { ...(db.profiles[sid] || {}), ...profile, updated_at: now() };
  writeStore(db);
  return db.profiles[sid];
}

export function listMemory(sessionId = "default") { return readStore().memory[normalizeSession(sessionId)] || []; }
export function addMemory(sessionId = "default", item = {}) {
  const db = readStore();
  const sid = normalizeSession(sessionId);
  db.memory[sid] ||= [];
  const record = { id: id("mem"), type: item.type || "note", title: item.title || "Garden note", body: item.body || item.note || item.summary || "", source: item.source || "user", created_at: now(), ...item };
  db.memory[sid].unshift(record);
  db.memory[sid] = db.memory[sid].slice(0, 200);
  writeStore(db);
  return record;
}

export function listTasks(sessionId = "default") { return readStore().tasks[normalizeSession(sessionId)] || []; }
export function addTask(sessionId = "default", item = {}) {
  const db = readStore();
  const sid = normalizeSession(sessionId);
  db.tasks[sid] ||= [];
  const record = { id: id("task"), title: item.title || item.task || "Garden task", priority: item.priority || "medium", due: item.due || item.window || "this week", status: item.status || "open", source: item.source || "JarDIYn", created_at: now(), updated_at: now(), ...item };
  db.tasks[sid].unshift(record);
  writeStore(db);
  return record;
}
export function updateTask(sessionId = "default", taskId, patch = {}) {
  const db = readStore();
  const sid = normalizeSession(sessionId);
  db.tasks[sid] ||= [];
  const idx = db.tasks[sid].findIndex((t) => t.id === taskId);
  if (idx === -1) return null;
  db.tasks[sid][idx] = { ...db.tasks[sid][idx], ...patch, updated_at: now() };
  writeStore(db);
  return db.tasks[sid][idx];
}

export function listPlants(sessionId = "default") { return readStore().plants[normalizeSession(sessionId)] || []; }
export function addPlant(sessionId = "default", item = {}) {
  const db = readStore();
  const sid = normalizeSession(sessionId);
  db.plants[sid] ||= [];
  const record = { id: id("plant"), name: item.name || item.common_name || "Tracked plant", botanical: item.botanical || item.scientific_name || "", location: item.location || "garden", status: item.status || "tracked", notes: item.notes || "", created_at: now(), updated_at: now(), ...item };
  db.plants[sid].unshift(record);
  writeStore(db);
  return record;
}

export function logAgentRun(run = {}) {
  const db = readStore();
  const record = { id: id("run"), created_at: now(), ...run };
  db.agent_runs.unshift(record);
  db.agent_runs = db.agent_runs.slice(0, 500);
  writeStore(db);
  return record;
}
export function listAgentRuns(limit = 50) { return readStore().agent_runs.slice(0, limit); }

export function logToolCall(call = {}) {
  const db = readStore();
  const record = { id: id("toolcall"), created_at: now(), ...call };
  db.tool_calls.unshift(record);
  db.tool_calls = db.tool_calls.slice(0, 1000);
  writeStore(db);
  return record;
}

export function clearSession(sessionId = "default") {
  const db = readStore();
  const sid = normalizeSession(sessionId);
  delete db.profiles[sid]; delete db.memory[sid]; delete db.tasks[sid]; delete db.plants[sid];
  writeStore(db);
  return { ok: true, session_id: sid };
}

export function storeSnapshot(sessionId = "default") {
  const sid = normalizeSession(sessionId);
  return { session_id: sid, profile: getGardenProfile(sid), memory: listMemory(sid), tasks: listTasks(sid), plants: listPlants(sid), agent_runs: listAgentRuns(25) };
}
