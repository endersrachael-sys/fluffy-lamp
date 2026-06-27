const sessions = new Map();

function blankSession() {
  return {
    profile: {},
    history: [],
    tasks: [],
    plants: [],
    diagnoses: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function getSession(sessionId = 'local-demo') {
  if (!sessions.has(sessionId)) sessions.set(sessionId, blankSession());
  return sessions.get(sessionId);
}

export function saveProfile(sessionId, profile = {}) {
  const session = getSession(sessionId);
  session.profile = { ...session.profile, ...profile };
  session.updatedAt = new Date().toISOString();
  return session.profile;
}

export function addHistory(sessionId, role, content, meta = {}) {
  const session = getSession(sessionId);
  session.history.push({ role, content, ...meta, at: new Date().toISOString() });
  session.history = session.history.slice(-40);
}

export function addTask(sessionId, task) {
  const session = getSession(sessionId);
  const item = {
    id: task.id || `task_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    title: task.title,
    priority: task.priority || 'medium',
    due_date: task.due_date || null,
    status: 'pending',
    reason: task.reason || '',
    createdAt: new Date().toISOString()
  };
  session.tasks.push(item);
  return item;
}

export function completeTask(sessionId, taskId) {
  const session = getSession(sessionId);
  const task = session.tasks.find(t => t.id === taskId);
  if (task) task.status = 'complete';
  return task || null;
}

export function addPlant(sessionId, plant) {
  const session = getSession(sessionId);
  const item = {
    id: plant.id || `plant_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    common_name: plant.common_name || plant.name || 'Plant',
    scientific_name: plant.scientific_name || '',
    location: plant.location || '',
    status: plant.status || 'active',
    createdAt: new Date().toISOString()
  };
  session.plants.push(item);
  return item;
}

export function addDiagnosis(sessionId, diagnosis) {
  const session = getSession(sessionId);
  const item = {
    id: diagnosis.id || `diag_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    suspected_issue: diagnosis.suspected_issue || 'plant stress',
    confidence: diagnosis.confidence || 'medium',
    status: 'open',
    follow_up_date: diagnosis.follow_up_date || null,
    createdAt: new Date().toISOString()
  };
  session.diagnoses.push(item);
  return item;
}
