const STORAGE_KEY = "jardiyn.gardenPassport.v3";
const SESSION_KEY = "jardiyn.sessionId.v3";
const HISTORY_KEY = "jardiyn.history.v3";

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const scenarios = [
  {
    id: "clay-soil",
    title: "Clay Soil Problem Yard",
    desc: "Heavy clay, drainage risk, beginner confidence.",
    profile: { site_name: "Clay Soil Problem Yard", zip_code: "49503", soil_type: "clay loam", sun_exposure: "partial_shade", goals: ["pollinators", "low maintenance", "curb appeal"], experience_level: "beginner", budget: "moderate", maintenance_tolerance: "low", drainage: "poor drainage", deer_pressure: "moderate", known_problems: ["heavy clay", "plants failed last year"], past_failures: ["lavender died", "plants rotted after rain"] },
    prompts: ["What will probably fail here?", "What should I avoid buying at the nursery?", "Create a realistic 30-day recovery plan.", "Give me 5 clay-tolerant pollinator plants.", "Generate a complete Garden Plan for this yard."]
  },
  {
    id: "beginner",
    title: "Beginner Backyard",
    desc: "Low-risk first garden with small wins.",
    profile: { site_name: "Beginner Backyard", zip_code: "49503", soil_type: "loam", sun_exposure: "full_sun", goals: ["low maintenance", "pollinators"], experience_level: "beginner", budget: "low", maintenance_tolerance: "low", drainage: "average drainage", deer_pressure: "unknown", known_problems: ["overwhelmed", "not sure where to start"], past_failures: [] },
    prompts: ["What should I plant first?", "Give me a weekend starter plan.", "What beginner mistakes should I avoid?", "Make this low maintenance.", "Generate a shopping list under a moderate budget."]
  },
  {
    id: "pollinator-native",
    title: "Pollinator Native Garden",
    desc: "Native/pollinator bed with seasonal interest.",
    profile: { site_name: "Pollinator Native Garden", zip_code: "49506", soil_type: "clay loam", sun_exposure: "full_sun", goals: ["native plants", "pollinators", "low maintenance"], experience_level: "intermediate", budget: "moderate", maintenance_tolerance: "medium", drainage: "average drainage", deer_pressure: "moderate", known_problems: ["needs all-season blooms"], past_failures: [] },
    prompts: ["Build a native pollinator palette.", "Create a bloom-season plan.", "What will look messy if I do this wrong?", "What should I ask a local nursery?", "Generate a Garden Plan."]
  },
  {
    id: "plant-diagnosis",
    title: "Plant Diagnosis",
    desc: "Yellow leaves, spots, watering uncertainty.",
    profile: { site_name: "Tomato Problem Bed", zip_code: "49507", soil_type: "loam", sun_exposure: "full_sun", goals: ["vegetables"], experience_level: "beginner", budget: "low", maintenance_tolerance: "medium", drainage: "average drainage", deer_pressure: "low", known_problems: ["yellow leaves", "dark spots"], past_failures: ["tomatoes failed last summer"] },
    prompts: ["My tomato has yellow leaves and dark spots. What should I check first?", "Is this overwatering or disease?", "What should I do today?", "What should I not spray yet?", "Give me a 7-day recovery plan."]
  },
  {
    id: "nursery-shopping",
    title: "Nursery Shopping Assistant",
    desc: "Avoid bad purchases before the cart is full.",
    profile: { site_name: "Nursery Shopping Trip", zip_code: "49503", soil_type: "clay loam", sun_exposure: "partial_shade", goals: ["native plants", "pollinators", "low maintenance"], experience_level: "beginner", budget: "moderate", maintenance_tolerance: "low", drainage: "poor drainage", deer_pressure: "high", known_problems: ["deer", "shade", "clay"], past_failures: ["impulse nursery purchases failed"] },
    prompts: ["What should I buy and avoid today?", "Give me a nursery question checklist.", "Create a $150 starter cart.", "Suggest substitutions if plants are unavailable.", "Check my shopping plan."]
  },
  {
    id: "drought-week",
    title: "Drought / Heat Stress Week",
    desc: "Weather-aware watering and plant triage.",
    profile: { site_name: "Heat Stress Yard", zip_code: "78704", soil_type: "sandy loam", sun_exposure: "full_sun", goals: ["low maintenance", "drought tolerant"], experience_level: "intermediate", budget: "moderate", maintenance_tolerance: "low", drainage: "fast drainage", deer_pressure: "low", known_problems: ["heat stress", "limited watering"], past_failures: [] },
    prompts: ["Should I water today?", "Which plants are most at risk?", "Give me a 7-day heat plan.", "What can I do without overwatering?", "What should I replace with drought-tolerant plants?"]
  },
  {
    id: "shade-yard",
    title: "Shady Front Yard",
    desc: "Attractive low-light planting that looks intentional.",
    profile: { site_name: "Shady Front Yard", zip_code: "10024", soil_type: "loam", sun_exposure: "full_shade", goals: ["curb appeal", "low maintenance"], experience_level: "beginner", budget: "moderate", maintenance_tolerance: "low", drainage: "average drainage", deer_pressure: "low", known_problems: ["low light"], past_failures: ["flowers did not bloom"] },
    prompts: ["What grows in this shade?", "Make this look designed, not random.", "What flowering plants are realistic?", "What should I avoid?", "Generate a shade Garden Plan."]
  },
  {
    id: "raised-bed-food",
    title: "Raised Bed Food Garden",
    desc: "Vegetables and herbs with realistic care.",
    profile: { site_name: "Raised Bed Food Garden", zip_code: "49507", soil_type: "loam", sun_exposure: "full_sun", goals: ["vegetables", "herbs"], experience_level: "beginner", budget: "moderate", maintenance_tolerance: "medium", drainage: "average drainage", deer_pressure: "moderate", known_problems: ["first raised bed"], past_failures: [] },
    prompts: ["Plan a 4x8 raised bed.", "What vegetables should I start with?", "Give me a watering schedule.", "What companion planting actually matters?", "Generate my first food garden plan."]
  },
  {
    id: "community-garden",
    title: "Community Garden",
    desc: "Volunteer-friendly education and maintenance.",
    profile: { site_name: "Community Garden", zip_code: "49503", soil_type: "unknown", sun_exposure: "full_sun", goals: ["vegetables", "pollinators", "education"], experience_level: "beginner", budget: "low", maintenance_tolerance: "medium", drainage: "unknown", deer_pressure: "unknown", known_problems: ["volunteer maintenance", "mixed skill levels"], past_failures: [] },
    prompts: ["Create a beginner community garden plan.", "Make a volunteer task list.", "What kid-safe plants should we use?", "Create a seasonal calendar.", "Write a grant-friendly garden summary."]
  },
  {
    id: "public-to-backyard",
    title: "Public Garden → Backyard",
    desc: "Translate inspiration into something maintainable.",
    profile: { site_name: "Public Garden Inspiration", zip_code: "49503", soil_type: "clay loam", sun_exposure: "partial_shade", goals: ["curb appeal", "pollinators", "low maintenance"], experience_level: "beginner", budget: "moderate", maintenance_tolerance: "low", drainage: "average drainage", deer_pressure: "moderate", known_problems: ["inspiration does not fit backyard"], past_failures: [] },
    prompts: ["Translate a professional garden look into my backyard.", "What parts should I not copy?", "Create a lower-maintenance version.", "Phase this over one year.", "Generate a backyard-scale Garden Plan."]
  }
];

const quickActions = [
  ["Plan Check Mode", "Check my garden plan. Be honest: what will fail, what is risky, what should I change, and what are my next 3 actions?"],
  ["Generate Garden Plan", "Generate a complete Garden Plan with recommended plants, avoid list, soil prep, watering, weekend tasks, shopping list, safety notes, nursery questions, and when to call a professional."],
  ["Garden Recovery", "Everything I plant seems to fail. Help me figure out what went wrong and give me a low-risk recovery plan."],
  ["Nursery List", "Create a practical nursery shopping list for my Garden Passport and tell me what not to buy."],
  ["Watering Check", "Should I water this week based on my Garden Passport and weather context?"],
  ["Future GIS", "Explain the future Property Passport, municipal GIS, satellite, and drone add-ons without pretending they are live." ]
];

function sessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getPassport() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
}

function setPassport(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...profile, updated_at: new Date().toISOString() }));
  renderProfileSummary();
}

function splitList(v) {
  return String(v || "").split(",").map(s => s.trim()).filter(Boolean);
}

function formToPassport() {
  const data = Object.fromEntries(new FormData($("#passportForm")).entries());
  return {
    ...data,
    goals: splitList(data.goals),
    known_problems: splitList(data.known_problems),
    past_failures: splitList(data.past_failures)
  };
}

function passportToForm(profile = {}) {
  const form = $("#passportForm");
  Object.entries(profile).forEach(([k, v]) => {
    const el = form.elements[k];
    if (!el) return;
    el.value = Array.isArray(v) ? v.join(", ") : (v || "");
  });
}

function renderProfileSummary() {
  const profile = getPassport();
  const target = $("#profileSummary");
  if (!profile) {
    target.classList.add("muted");
    target.innerHTML = "No Garden Passport saved yet.";
    return;
  }
  target.classList.remove("muted");
  const fields = [
    ["Site", profile.site_name], ["ZIP", profile.zip_code], ["Zone", profile.hardiness_zone || "estimate when needed"],
    ["Soil", profile.soil_type || "unknown"], ["Sun", labelSun(profile.sun_exposure)], ["Goals", (profile.goals || []).join(", ")],
    ["Maintenance", profile.maintenance_tolerance], ["Drainage", profile.drainage], ["Deer", profile.deer_pressure]
  ];
  target.innerHTML = fields.filter(([,v]) => v).map(([k, v]) => `<span class="profile-pill"><strong>${escapeHtml(k)}:</strong>&nbsp;${escapeHtml(v)}</span>`).join("") + `<p class="fine-print">Saved in this browser. Sent to JarDIYn only when you ask a question.</p>`;
}

function labelSun(v) {
  return { full_sun: "Full sun", partial_shade: "Partial shade", full_shade: "Full shade" }[v] || v || "unknown";
}

function renderScenarios(activeId = "clay-soil") {
  const grid = $("#scenarioGrid");
  grid.innerHTML = scenarios.map((s, i) => `<button class="scenario-card ${s.id === activeId ? "active" : ""}" data-scenario="${s.id}"><span class="num">${String(i+1).padStart(2,"0")}</span><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.desc)}</p></button>`).join("");
  renderPrompts(activeId);
}

function renderPrompts(id) {
  const s = scenarios.find(x => x.id === id) || scenarios[0];
  $("#promptChips").innerHTML = s.prompts.map(p => `<button class="button" data-prompt="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("");
}

function loadScenario(id = "clay-soil") {
  const scenario = scenarios.find(s => s.id === id) || scenarios[0];
  setPassport(scenario.profile);
  passportToForm(scenario.profile);
  renderScenarios(scenario.id);
  $("#messageInput").value = scenario.prompts[0];
  document.getElementById("demo").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderQuickActions() {
  $("#quickActions").innerHTML = quickActions.map(([label, prompt]) => `<button class="button" data-quick="${escapeHtml(prompt)}">${escapeHtml(label)}</button>`).join("");
}

async function sendMessage(promptOverride) {
  const message = promptOverride || $("#messageInput").value.trim();
  if (!message) return;
  const profile = getPassport() || formToPassport();
  setPassport(profile);
  setLoading(true);
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, garden_profile: profile, session_id: sessionId(), history: loadHistory() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    saveHistory({ role: "user", content: message });
    saveHistory({ role: "assistant", content: data.answer || data.response || "", meta: data });
    renderResponse(data);
  } catch (err) {
    renderError(err.message);
  } finally {
    setLoading(false);
  }
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]").slice(-8); } catch { return []; }
}
function saveHistory(turn) {
  const history = loadHistory();
  history.push({ ...turn, at: new Date().toISOString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-20)));
}

function setLoading(isLoading) {
  $("#sendMessage").disabled = isLoading;
  $("#responseOutput").classList.toggle("muted", isLoading);
  if (isLoading) $("#responseOutput").innerHTML = "Working through your Garden Passport and tools…";
}

function renderResponse(data) {
  const answer = data.answer || data.response || "No answer returned.";
  $("#responseOutput").classList.remove("muted");
  $("#responseOutput").innerHTML = formatMarkdown(answer);
  const trace = $("#traceDetails");
  trace.classList.remove("hidden");
  $("#traceOutput").innerHTML = renderTrace(data);
  if (isDebug()) loadDebugPanel(data);
}

function renderTrace(data) {
  const tools = (data.toolsUsed || []).length ? data.toolsUsed.join(", ") : "No tools used";
  const sources = (data.sourcesUsed || []).join(", ") || "Garden Passport / general guidance";
  const items = [
    ["Request ID", data.requestId || "—"],
    ["Mode", data.mode || "—"],
    ["Tools used", tools],
    ["Sources used", sources],
    ["Confidence", data.confidence || "—"],
    ["Profile received", data.profileReceived ? "yes" : "unknown"]
  ];
  return `<div class="trace-grid">${items.map(([k,v]) => `<div class="trace-item"><strong>${escapeHtml(k)}</strong><br>${escapeHtml(String(v))}</div>`).join("")}</div>`;
}

function renderError(message) {
  $("#responseOutput").classList.remove("muted");
  $("#responseOutput").innerHTML = `<p><strong>JarDIYn could not complete the request.</strong></p><p>${escapeHtml(message)}</p><p>Check Render logs, /api/health, and whether ANTHROPIC_API_KEY is set. The app should still work in transparent fallback mode.</p>`;
}

function formatMarkdown(md) {
  let html = escapeHtml(md || "");
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/^- (.*)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`);
  html = html.replace(/\n{2,}/g, "</p><p>");
  html = `<p>${html}</p>`.replace(/<p><h/g, "<h").replace(/<\/h([23])><\/p>/g, "</h$1>").replace(/<p><ul>/g, "<ul>").replace(/<\/ul><\/p>/g, "</ul>");
  return html;
}

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}

function isDebug() { return new URLSearchParams(location.search).get("debug") === "true"; }

async function loadDebugPanel(lastResponse) {
  const panel = $("#debugPanel");
  if (!isDebug()) return panel.classList.add("hidden");
  panel.classList.remove("hidden");
  const [status, tools, sources, health] = await Promise.allSettled([
    fetch("/api/debug/status").then(r => r.json()),
    fetch("/api/tools").then(r => r.json()),
    fetch("/api/sources").then(r => r.json()),
    fetch("/api/health").then(r => r.json())
  ]);
  const safe = x => x.status === "fulfilled" ? x.value : { error: "failed" };
  panel.innerHTML = `<h2>Sanitized Debug</h2>
    <p>No secrets, raw prompts, private property data, or stack traces are exposed.</p>
    <p><strong>Health:</strong> <code>${escapeHtml(JSON.stringify(safe(health)))}</code></p>
    <p><strong>Status:</strong> <code>${escapeHtml(JSON.stringify(safe(status)))}</code></p>
    <p><strong>Tools:</strong> ${escapeHtml(String(safe(tools).count || 0))} registered</p>
    <p><strong>Sources:</strong> ${escapeHtml((safe(sources).sources || []).map(s => `${s.name}:${s.status}`).join(" | "))}</p>
    ${lastResponse ? `<p><strong>Last request:</strong> ${escapeHtml(lastResponse.requestId || "—")} · ${escapeHtml((lastResponse.toolsUsed || []).join(", ") || "no tools")}</p>` : ""}`;
}

function bindEvents() {
  $("#passportForm").addEventListener("submit", async e => {
    e.preventDefault();
    const profile = formToPassport();
    setPassport(profile);
    try {
      await fetch("/api/garden-profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session_id: sessionId(), garden_profile: profile }) });
    } catch { /* localStorage is authoritative for MVP */ }
  });
  $("#resetPassport").addEventListener("click", () => { localStorage.removeItem(STORAGE_KEY); $("#passportForm").reset(); renderProfileSummary(); });
  document.addEventListener("click", e => {
    const scenario = e.target.closest("[data-scenario]");
    if (scenario) return loadScenario(scenario.dataset.scenario);
    const prompt = e.target.closest("[data-prompt]");
    if (prompt) { $("#messageInput").value = prompt.dataset.prompt; return sendMessage(prompt.dataset.prompt); }
    const quick = e.target.closest("[data-quick]");
    if (quick) { $("#messageInput").value = quick.dataset.quick; return sendMessage(quick.dataset.quick); }
    if (e.target.matches("[data-action='load-demo']")) return loadScenario("clay-soil");
    if (e.target.matches("[data-action='plan-check']")) { location.hash = "#ask"; $("#messageInput").value = quickActions[0][1]; }
  });
  $("#sendMessage").addEventListener("click", () => sendMessage());
  $("#planCheck").addEventListener("click", () => sendMessage("Check my garden plan. Be honest but supportive. Format the answer as: What looks good, What may fail, What I would change, Next 3 actions."));
  $("#gardenPlan").addEventListener("click", () => sendMessage("Generate a complete Garden Plan with Site Summary, Recommended Plants, Avoid List, Soil Prep, Watering Guidance, Weekend Tasks, Shopping List, Safety Notes, Sources Used, Questions for Local Nursery, and When to Call a Professional."));
}

function boot() {
  sessionId();
  const profile = getPassport();
  if (profile) passportToForm(profile);
  renderProfileSummary();
  renderScenarios();
  renderQuickActions();
  bindEvents();
  if (isDebug()) loadDebugPanel();
}

boot();
