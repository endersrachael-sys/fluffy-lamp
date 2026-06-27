const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const sessionId = localStorage.getItem('jardiyn.sessionId') || `session_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
localStorage.setItem('jardiyn.sessionId', sessionId);

const scenarios = [
  {
    id: 'clay-soil',
    title: 'Clay Soil Problem Yard',
    desc: 'Grand Rapids clay, failed plants, wants pollinators and low maintenance.',
    profile: { site_name: 'Clay Soil Demo', zip_code: '49503', soil_type: 'clay', sun_exposure: 'part sun', maintenance_tolerance: 'low', goals: ['pollinators', 'natives', 'low maintenance'], known_problems: 'heavy clay and plants failed last year' },
    prompt: 'Plan Check: I want a low-maintenance pollinator garden in heavy clay. What will fail and what should I change?'
  },
  {
    id: 'beginner',
    title: 'Beginner Backyard',
    desc: 'First garden, full sun, wants a small win without wasting money.',
    profile: { site_name: 'Beginner Demo', zip_code: '22030', soil_type: 'unknown', sun_exposure: 'full sun', maintenance_tolerance: 'low', goals: ['vegetables', 'flowers'] },
    prompt: 'Generate a simple beginner garden plan that is realistic for my yard and budget.'
  },
  {
    id: 'diagnosis',
    title: 'Plant Diagnosis',
    desc: 'Yellowing and wilting plants; needs cautious triage before treatment.',
    profile: { site_name: 'Diagnosis Demo', zip_code: '33401', soil_type: 'raised-bed', sun_exposure: 'full sun', maintenance_tolerance: 'moderate', goals: ['vegetables', 'herbs'] },
    prompt: 'Diagnose my plant problem: tomato leaves are yellowing and curling after hot weather. What should I check first?'
  },
  {
    id: 'shade',
    title: 'Shady Front Yard',
    desc: 'North-facing shade, deer pressure, wants polished curb appeal.',
    profile: { site_name: 'Shade Demo', zip_code: '10025', soil_type: 'loam', sun_exposure: 'shade', maintenance_tolerance: 'low', goals: ['natives', 'low maintenance', 'flowers'], known_problems: 'deer pressure and deep shade' },
    prompt: 'What should I plant in a shady front yard with deer pressure, and what should I avoid?'
  }
];

function markdownToHtml(md = '') {
  const lines = String(md).split('\n');
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }
    if (line.startsWith('### ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${escapeHtml(line.slice(4))}</h3>`; continue; }
    if (line.startsWith('## ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h2>${escapeHtml(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('# ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h1>${escapeHtml(line.slice(2))}</h1>`; continue; }
    if (line.startsWith('- ')) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${escapeHtml(line.slice(2))}</li>`; continue; }
    if (/^\d+\.\s/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${escapeHtml(line.replace(/^\d+\.\s/, ''))}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    html += `<p>${escapeHtml(line)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function getGoals() {
  return $$('.goal.active').map(b => b.dataset.goal);
}

function getProfile() {
  return {
    site_name: $('#siteName')?.value?.trim() || 'My Garden',
    zip_code: $('#zip')?.value?.trim() || '',
    soil_type: $('#soil')?.value || 'unknown',
    sun_exposure: $('#sun')?.value || 'unknown',
    maintenance_tolerance: $('#maintenance')?.value || 'low',
    goals: getGoals()
  };
}

function setProfile(profile = {}) {
  if ($('#siteName')) $('#siteName').value = profile.site_name || profile.siteName || 'My Garden';
  if ($('#zip')) $('#zip').value = profile.zip_code || profile.zip || '';
  if ($('#soil')) $('#soil').value = profile.soil_type || profile.soil || 'unknown';
  if ($('#sun')) $('#sun').value = profile.sun_exposure || profile.sun || 'full sun';
  if ($('#maintenance')) $('#maintenance').value = profile.maintenance_tolerance || profile.maintenance || 'low';
  $$('.goal').forEach(btn => btn.classList.toggle('active', (profile.goals || []).includes(btn.dataset.goal)));
  if (!(profile.goals || []).length) $('.goal[data-goal="vegetables"]')?.classList.add('active');
  updateProfileSummary();
}

function updateProfileSummary() {
  const p = getProfile();
  const text = `${p.site_name}<br>ZIP ${p.zip_code || '—'} · ${p.soil_type} · ${p.sun_exposure}<br>${p.goals.length ? p.goals.join(', ') : 'No goals selected'} · ${p.maintenance_tolerance} maintenance`;
  $('#profileSummary').innerHTML = text;
  renderGardenDetail();
}

async function saveProfile() {
  const profile = getProfile();
  localStorage.setItem('jardiyn.profile', JSON.stringify(profile));
  updateProfileSummary();
  try {
    await fetch('/api/garden-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, profile })
    });
    toast('Garden Passport saved.');
  } catch {
    toast('Saved locally. Server sync unavailable.');
  }
}

function renderGardenDetail() {
  const p = getProfile();
  const items = [
    ['Site', p.site_name], ['ZIP', p.zip_code || 'Not set'], ['Soil', p.soil_type], ['Sun', p.sun_exposure], ['Maintenance', p.maintenance_tolerance], ['Goals', p.goals.join(', ') || 'None']
  ];
  const el = $('#gardenDetail');
  if (el) el.innerHTML = items.map(([k, v]) => `<div class="detail-item"><b>${k}</b>${escapeHtml(v)}</div>`).join('');
}

function appendMessage(role, content, meta = {}) {
  $('#welcomeCard')?.remove();
  const el = document.createElement('div');
  el.className = `message ${role}`;
  if (role === 'assistant') {
    el.innerHTML = markdownToHtml(content);
    const tools = meta.toolsUsed || meta.tools_used || [];
    const sources = meta.sources || [];
    if (tools.length || sources.length) {
      const trace = document.createElement('details');
      trace.className = 'trace';
      trace.innerHTML = `<summary>Sources and trace</summary><div><b>Tools:</b> ${escapeHtml(tools.join(', ') || 'none')}</div><div><b>Sources:</b> ${escapeHtml(sources.join(', ') || 'Garden Passport')}</div><div><b>Mode:</b> ${escapeHtml(meta.mode || 'unknown')}</div>`;
      el.appendChild(trace);
    }
  } else {
    el.textContent = content;
  }
  $('#conversation').appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function setLoading(isLoading) {
  $('#sendBtn').disabled = isLoading;
  $('#sendBtn').textContent = isLoading ? 'Working…' : 'Send';
}

async function sendMessage(message) {
  const text = String(message || $('#messageInput').value || '').trim();
  if (!text) return;
  $('#messageInput').value = '';
  appendMessage('user', text);
  setLoading(true);
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: text, profile: getProfile() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.detail || 'Request failed');
    appendMessage('assistant', data.response || data.answer || 'No response returned.', data);
    await loadGardenMemory();
  } catch (err) {
    appendMessage('assistant', `# Connection issue\n\n${err.message}\n\nCheck that the server is running and try again.`);
  } finally {
    setLoading(false);
    $('#messageInput').focus();
  }
}

function switchTab(tab) {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab-view').forEach(v => v.classList.toggle('active', v.id === `tab-${tab}`));
  if (tab === 'tasks') loadGardenMemory();
  if (tab === 'plants') loadGardenMemory();
}

async function loadGardenMemory() {
  try {
    const res = await fetch(`/api/garden/${sessionId}`);
    if (!res.ok) return;
    const data = await res.json();
    renderTasks(data.tasks || []);
    renderPlants(data.plants || []);
  } catch {}
}

function renderTasks(tasks) {
  const pending = tasks.filter(t => t.status !== 'complete');
  $('#memoryTasks').textContent = pending.length ? `${pending.length} pending task${pending.length === 1 ? '' : 's'}` : 'No pending tasks.';
  const badge = $('#taskBadge');
  if (badge) { badge.hidden = pending.length === 0; badge.textContent = pending.length; }
  const list = $('#tasksList');
  if (!list) return;
  if (!pending.length) { list.textContent = 'No tasks yet. Run a Plan Check or Garden Plan.'; return; }
  list.innerHTML = pending.map(t => `<div class="task-item"><div><strong>${escapeHtml(t.title)}</strong><br><small>${escapeHtml(t.reason || t.priority || 'Next action')}</small></div><button data-task="${t.id}">Done</button></div>`).join('');
  list.querySelectorAll('[data-task]').forEach(btn => btn.addEventListener('click', () => completeTask(btn.dataset.task)));
}

async function completeTask(taskId) {
  await fetch(`/api/tasks/${sessionId}/${taskId}/complete`, { method: 'POST' });
  loadGardenMemory();
}

function renderPlants(plants) {
  const grid = $('#plantGrid');
  if (!grid) return;
  if (!plants.length) { grid.textContent = 'No plants yet.'; return; }
  grid.innerHTML = plants.map(p => `<div class="plant-card"><strong>🌱 ${escapeHtml(p.common_name)}</strong><small>${escapeHtml(p.scientific_name || 'Saved plant')}${p.location ? ` · ${escapeHtml(p.location)}` : ''}</small></div>`).join('');
}

async function addPlantPrompt() {
  const common_name = prompt('Plant name');
  if (!common_name) return;
  const location = prompt('Location in garden (optional)') || '';
  await fetch(`/api/plants/${sessionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ common_name, location }) });
  loadGardenMemory();
}

function openDemo() {
  const grid = $('#scenarioGrid');
  grid.innerHTML = scenarios.map(s => `<button class="scenario-card" data-scenario="${s.id}"><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(s.desc)}</small></button>`).join('');
  grid.querySelectorAll('[data-scenario]').forEach(btn => btn.addEventListener('click', () => fireScenario(btn.dataset.scenario)));
  $('#demoModal').classList.add('open');
  $('#demoModal').setAttribute('aria-hidden', 'false');
}

function closeDemo() {
  $('#demoModal').classList.remove('open');
  $('#demoModal').setAttribute('aria-hidden', 'true');
}

function fireScenario(id) {
  const scenario = scenarios.find(s => s.id === id);
  if (!scenario) return;
  setProfile(scenario.profile);
  saveProfile();
  closeDemo();
  switchTab('chat');
  setTimeout(() => sendMessage(scenario.prompt), 200);
}

async function runStatus() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    const pill = $('#statusPill');
    pill.textContent = data.mode === 'live-llm' ? 'Live intelligence connected' : 'Sandbox mode connected';
    pill.className = `status-pill ${data.status === 'ok' ? 'ok' : 'warn'}`;
    if (new URLSearchParams(location.search).get('debug') === 'true') {
      $('#debugToggle').hidden = false;
      const debug = await fetch('/api/debug/status').then(r => r.json());
      $('#debugOutput').textContent = JSON.stringify(debug, null, 2);
      $('#debugPanel').hidden = false;
    }
  } catch {
    $('#statusPill').textContent = 'Server unavailable';
    $('#statusPill').className = 'status-pill warn';
  }
}

function toast(msg) {
  const old = $('#toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'toast';
  el.textContent = msg;
  el.style.cssText = 'position:fixed;right:18px;top:70px;background:#082711;color:white;padding:12px 14px;border-radius:12px;z-index:100;box-shadow:0 12px 30px rgba(0,0,0,.18)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function bindEvents() {
  $$('.goal').forEach(btn => btn.addEventListener('click', () => { btn.classList.toggle('active'); updateProfileSummary(); }));
  ['siteName','zip','soil','sun','maintenance'].forEach(id => $(`#${id}`)?.addEventListener('change', updateProfileSummary));
  $('#saveProfileBtn')?.addEventListener('click', saveProfile);
  $('#lookupZoneBtn')?.addEventListener('click', () => sendMessage(`Look up the USDA zone and frost timing for ZIP ${getProfile().zip_code}.`));
  $('#planCheckBtn')?.addEventListener('click', () => sendMessage('Plan Check: review my current garden idea and tell me what will fail, what to change, and my next 3 actions.'));
  $('#gardenPlanBtn')?.addEventListener('click', () => sendMessage('Generate a complete Garden Plan using my Garden Passport. Include plants, avoid list, weekend tasks, shopping list, and safety notes.'));
  $('#heroPlanCheck')?.addEventListener('click', () => $('#planCheckBtn').click());
  $('#heroGardenPlan')?.addEventListener('click', () => $('#gardenPlanBtn').click());
  $('#openDemoBtn')?.addEventListener('click', openDemo);
  $('#closeDemo')?.addEventListener('click', closeDemo);
  $('#demoModal')?.addEventListener('click', (e) => { if (e.target.id === 'demoModal') closeDemo(); });
  $$('.action, .quick-card').forEach(btn => btn.addEventListener('click', () => sendMessage(btn.dataset.prompt)));
  $$('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $('#composer')?.addEventListener('submit', (e) => { e.preventDefault(); sendMessage(); });
  $('#messageInput')?.addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; });
  $('#photoBtn')?.addEventListener('click', () => $('#photoInput').click());
  $('#photoInput')?.addEventListener('change', () => sendMessage('Diagnose this plant photo. Tell me what to check first and what not to do yet.'));
  $('#addPlantBtn')?.addEventListener('click', addPlantPrompt);
  $('#mobileMenu')?.addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#debugToggle')?.addEventListener('click', () => $('#debugPanel').hidden = false);
  $('#closeDebug')?.addEventListener('click', () => $('#debugPanel').hidden = true);
}

(function boot() {
  bindEvents();
  const saved = localStorage.getItem('jardiyn.profile');
  if (saved) {
    try { setProfile(JSON.parse(saved)); } catch { updateProfileSummary(); }
  } else {
    updateProfileSummary();
  }
  renderGardenDetail();
  loadGardenMemory();
  runStatus();
})();
