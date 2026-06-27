const sessions = new Map();
export const PERSISTENCE_MODE = "client-localStorage + server-memory-session";

export function saveProfile(sessionId, profile) {
  if (!sessionId) return;
  const current = sessions.get(sessionId) || { profile: null, history: [] };
  current.profile = { ...profile, saved_at: new Date().toISOString() };
  sessions.set(sessionId, current);
}

export function loadProfile(sessionId) {
  return sessions.get(sessionId)?.profile || null;
}

export function saveTurn(sessionId, role, content, metadata = {}) {
  if (!sessionId) return;
  const current = sessions.get(sessionId) || { profile: null, history: [] };
  current.history.push({ role, content: String(content || "").slice(0, 10000), metadata, created_at: new Date().toISOString() });
  current.history = current.history.slice(-40);
  sessions.set(sessionId, current);
}

export function loadHistory(sessionId, limit = 20) {
  return (sessions.get(sessionId)?.history || []).slice(-limit);
}

export function sessionCount() {
  return sessions.size;
}
