/**
 * JarDIYn — Persistence Layer
 * ============================
 * Stores garden profiles and conversation history so they survive page
 * refreshes and server restarts. This delivers the "garden history is
 * the moat" thesis from the product proposal.
 *
 * Design: tries Node's built-in node:sqlite (Node 22.5+). If unavailable,
 * falls back to an in-memory Map so the app still runs everywhere with
 * ZERO npm dependencies. No external database, no setup.
 *
 * Data is keyed by a session_id the client generates and stores locally.
 */

let db = null;
let useMemory = false;
const memStore = new Map(); // fallback: session_id → { profile, history }

// ── Try to initialize SQLite (Node 22.5+) ─────────────────────────────────
try {
  const { DatabaseSync } = await import("node:sqlite");
  const path = process.env.DB_PATH || "./jardiyn.db";
  db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS gardens (
      session_id TEXT PRIMARY KEY,
      profile_json TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      role TEXT,
      content TEXT,
      tools_used TEXT,
      created_at TEXT
    );
  `);
  console.log(`[persistence] SQLite ready → ${path}`);
} catch (err) {
  useMemory = true;
  console.log(`[persistence] node:sqlite unavailable — using in-memory store (${err.message.slice(0, 50)})`);
}

// ── Save / update a garden profile ────────────────────────────────────────
export function saveProfile(sessionId, profile) {
  if (!sessionId) return;
  const now = new Date().toISOString();
  if (useMemory) {
    const rec = memStore.get(sessionId) || { history: [] };
    rec.profile = profile;
    memStore.set(sessionId, rec);
    return;
  }
  db.prepare(`
    INSERT INTO gardens (session_id, profile_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET profile_json = ?, updated_at = ?
  `).run(sessionId, JSON.stringify(profile), now, JSON.stringify(profile), now);
}

// ── Load a garden profile ─────────────────────────────────────────────────
export function loadProfile(sessionId) {
  if (!sessionId) return null;
  if (useMemory) return memStore.get(sessionId)?.profile || null;
  const row = db.prepare(`SELECT profile_json FROM gardens WHERE session_id = ?`).get(sessionId);
  return row ? JSON.parse(row.profile_json) : null;
}

// ── Append a chat turn ────────────────────────────────────────────────────
export function saveTurn(sessionId, role, content, toolsUsed = []) {
  if (!sessionId) return;
  const now = new Date().toISOString();
  if (useMemory) {
    const rec = memStore.get(sessionId) || { history: [] };
    rec.history.push({ role, content, tools_used: toolsUsed, created_at: now });
    if (rec.history.length > 40) rec.history = rec.history.slice(-40);
    memStore.set(sessionId, rec);
    return;
  }
  db.prepare(`
    INSERT INTO history (session_id, role, content, tools_used, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, role, content, JSON.stringify(toolsUsed), now);
}

// ── Load recent history (for multi-turn context + history view) ───────────
export function loadHistory(sessionId, limit = 20) {
  if (!sessionId) return [];
  if (useMemory) return (memStore.get(sessionId)?.history || []).slice(-limit);
  const rows = db.prepare(`
    SELECT role, content, tools_used, created_at
    FROM history WHERE session_id = ?
    ORDER BY id DESC LIMIT ?
  `).all(sessionId, limit);
  return rows.reverse().map(r => ({
    role: r.role, content: r.content,
    tools_used: JSON.parse(r.tools_used || "[]"), created_at: r.created_at
  }));
}

export const PERSISTENCE_MODE = useMemory ? "memory" : "sqlite";
