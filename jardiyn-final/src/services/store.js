/**
 * JarDIYn — Persistence Layer
 * ============================
 * Phase 2: Garden Memory
 *
 * Tables:
 *   gardens        — garden profile per session
 *   history        — conversation turns
 *   diagnoses      — every plant diagnosis with photo ref + outcome
 *   tasks          — follow-up tasks created from diagnoses / plans
 *   plants         — plant inventory per garden
 *
 * Design: node:sqlite (Node 22.5+) with in-memory fallback.
 * Zero npm dependencies.
 */

let db = null;
let useMemory = false;
const mem = {
  gardens:   new Map(),
  history:   new Map(),   // session_id → [{role,content,tools_used,created_at}]
  diagnoses: new Map(),   // session_id → [{...}]
  tasks:     new Map(),   // session_id → [{...}]
  plants:    new Map(),   // session_id → [{...}]
};

try {
  const { DatabaseSync } = await import("node:sqlite");
  const path = process.env.DB_PATH || "./jardiyn.db";
  db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS gardens (
      session_id   TEXT PRIMARY KEY,
      profile_json TEXT,
      updated_at   TEXT
    );
    CREATE TABLE IF NOT EXISTS history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT,
      role         TEXT,
      content      TEXT,
      tools_used   TEXT,
      created_at   TEXT
    );
    CREATE TABLE IF NOT EXISTS diagnoses (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id       TEXT,
      suspected_issue  TEXT,
      confidence       TEXT,
      symptoms         TEXT,
      actions_json     TEXT,
      tools_used       TEXT,
      follow_up_date   TEXT,
      status           TEXT DEFAULT 'open',
      created_at       TEXT
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      TEXT,
      diagnosis_id    INTEGER,
      title           TEXT,
      reason          TEXT,
      due_date        TEXT,
      priority        TEXT DEFAULT 'medium',
      status          TEXT DEFAULT 'pending',
      completed_at    TEXT,
      created_at      TEXT
    );
    CREATE TABLE IF NOT EXISTS plants (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      TEXT,
      common_name     TEXT,
      scientific_name TEXT,
      location        TEXT,
      status          TEXT DEFAULT 'active',
      notes           TEXT,
      added_at        TEXT
    );
  `);
  console.log(`[persistence] SQLite ready → ${path}`);
} catch (err) {
  useMemory = true;
  console.log(`[persistence] in-memory store (${err.message.slice(0, 60)})`);
}

const now = () => new Date().toISOString();

// ── Garden Profile ─────────────────────────────────────────────────────────
export function saveProfile(sessionId, profile) {
  if (!sessionId) return;
  if (useMemory) { const r = mem.gardens.get(sessionId) || {}; r.profile = profile; mem.gardens.set(sessionId, r); return; }
  db.prepare(`INSERT INTO gardens (session_id,profile_json,updated_at) VALUES (?,?,?)
    ON CONFLICT(session_id) DO UPDATE SET profile_json=?,updated_at=?`)
    .run(sessionId, JSON.stringify(profile), now(), JSON.stringify(profile), now());
}

export function loadProfile(sessionId) {
  if (!sessionId) return null;
  if (useMemory) return mem.gardens.get(sessionId)?.profile || null;
  const row = db.prepare(`SELECT profile_json FROM gardens WHERE session_id=?`).get(sessionId);
  return row ? JSON.parse(row.profile_json) : null;
}

// ── Conversation History ───────────────────────────────────────────────────
export function saveTurn(sessionId, role, content, toolsUsed = []) {
  if (!sessionId) return;
  if (useMemory) {
    const r = mem.history.get(sessionId) || [];
    r.push({ role, content, tools_used: toolsUsed, created_at: now() });
    if (r.length > 40) r.splice(0, r.length - 40);
    mem.history.set(sessionId, r);
    return;
  }
  db.prepare(`INSERT INTO history (session_id,role,content,tools_used,created_at) VALUES (?,?,?,?,?)`)
    .run(sessionId, role, content, JSON.stringify(toolsUsed), now());
}

export function loadHistory(sessionId, limit = 20) {
  if (!sessionId) return [];
  if (useMemory) return (mem.history.get(sessionId) || []).slice(-limit);
  const rows = db.prepare(`SELECT role,content,tools_used,created_at FROM history
    WHERE session_id=? ORDER BY id DESC LIMIT ?`).all(sessionId, limit);
  return rows.reverse().map(r => ({
    role: r.role, content: r.content,
    tools_used: JSON.parse(r.tools_used || "[]"), created_at: r.created_at
  }));
}

// ── Diagnoses ──────────────────────────────────────────────────────────────
export function saveDiagnosis(sessionId, { suspected_issue, confidence, symptoms, actions, tools_used, follow_up_days = 3 }) {
  if (!sessionId) return null;
  const follow_up = new Date(Date.now() + follow_up_days * 86400000).toISOString().slice(0, 10);
  if (useMemory) {
    const id = Date.now();
    const r = mem.diagnoses.get(sessionId) || [];
    r.push({ id, session_id: sessionId, suspected_issue, confidence, symptoms,
              actions_json: actions, tools_used, follow_up_date: follow_up,
              status: 'open', created_at: now() });
    mem.diagnoses.set(sessionId, r);
    return id;
  }
  const stmt = db.prepare(`INSERT INTO diagnoses
    (session_id,suspected_issue,confidence,symptoms,actions_json,tools_used,follow_up_date,created_at)
    VALUES (?,?,?,?,?,?,?,?)`);
  const res = stmt.run(sessionId, suspected_issue, confidence || 'medium',
    symptoms, JSON.stringify(actions || []), JSON.stringify(tools_used || []), follow_up, now());
  return res.lastInsertRowid;
}

export function loadDiagnoses(sessionId, limit = 10) {
  if (!sessionId) return [];
  if (useMemory) return (mem.diagnoses.get(sessionId) || []).slice(-limit);
  return db.prepare(`SELECT * FROM diagnoses WHERE session_id=? ORDER BY id DESC LIMIT ?`)
    .all(sessionId, limit)
    .map(r => ({ ...r, actions_json: JSON.parse(r.actions_json || "[]"), tools_used: JSON.parse(r.tools_used || "[]") }));
}

// ── Tasks ──────────────────────────────────────────────────────────────────
export function saveTask(sessionId, { title, reason, due_date, priority = 'medium', diagnosis_id = null }) {
  if (!sessionId) return null;
  if (useMemory) {
    const id = Date.now();
    const r = mem.tasks.get(sessionId) || [];
    r.push({ id, session_id: sessionId, title, reason, due_date, priority, diagnosis_id, status: 'pending', created_at: now() });
    mem.tasks.set(sessionId, r);
    return id;
  }
  const res = db.prepare(`INSERT INTO tasks (session_id,diagnosis_id,title,reason,due_date,priority,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(sessionId, diagnosis_id, title, reason, due_date, priority, now());
  return res.lastInsertRowid;
}

export function loadTasks(sessionId, status = null) {
  if (!sessionId) return [];
  if (useMemory) {
    const all = mem.tasks.get(sessionId) || [];
    return status ? all.filter(t => t.status === status) : all;
  }
  const q = status
    ? `SELECT * FROM tasks WHERE session_id=? AND status=? ORDER BY due_date ASC`
    : `SELECT * FROM tasks WHERE session_id=? ORDER BY due_date ASC`;
  return status ? db.prepare(q).all(sessionId, status) : db.prepare(q).all(sessionId);
}

export function completeTask(sessionId, taskId) {
  if (useMemory) {
    const r = mem.tasks.get(sessionId) || [];
    const t = r.find(t => t.id == taskId);
    if (t) { t.status = 'done'; t.completed_at = now(); }
    return;
  }
  db.prepare(`UPDATE tasks SET status='done', completed_at=? WHERE id=? AND session_id=?`)
    .run(now(), taskId, sessionId);
}

// ── Plant Inventory ────────────────────────────────────────────────────────
export function savePlant(sessionId, { common_name, scientific_name, location, status = 'active', notes }) {
  if (!sessionId) return null;
  if (useMemory) {
    const id = Date.now();
    const r = mem.plants.get(sessionId) || [];
    r.push({ id, session_id: sessionId, common_name, scientific_name, location, status, notes, added_at: now() });
    mem.plants.set(sessionId, r);
    return id;
  }
  const res = db.prepare(`INSERT INTO plants (session_id,common_name,scientific_name,location,status,notes,added_at)
    VALUES (?,?,?,?,?,?,?)`).run(sessionId, common_name, scientific_name || null, location || null, status, notes || null, now());
  return res.lastInsertRowid;
}

export function loadPlants(sessionId) {
  if (!sessionId) return [];
  if (useMemory) return mem.plants.get(sessionId) || [];
  return db.prepare(`SELECT * FROM plants WHERE session_id=? AND status != 'removed' ORDER BY added_at DESC`)
    .all(sessionId);
}

// ── Garden Activity Feed ───────────────────────────────────────────────────
// Returns a unified timeline of recent diagnoses + pending tasks + plants
export function loadActivityFeed(sessionId, limit = 15) {
  if (!sessionId) return { diagnoses: [], tasks: [], plants: [] };
  return {
    diagnoses: loadDiagnoses(sessionId, 5),
    tasks:     loadTasks(sessionId, 'pending').slice(0, 10),
    plants:    loadPlants(sessionId).slice(0, limit),
  };
}

export const PERSISTENCE_MODE = useMemory ? "memory" : "sqlite";
