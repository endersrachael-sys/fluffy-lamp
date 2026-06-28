/**
 * JarDIYn — app.js
 * Base: ask-first/jardiyn-ask-first-fused (proven UX)
 * Extended: 10 demo scenarios, photo pipeline, situational awareness,
 *           task completion, plant tracking, gold demo overlay.
 */

"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(v = "") {
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function md(text = "") {
  let h = esc(text);
  h = h.replace(/^### (.*)$/gm,"<h3>$1</h3>").replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>");
  h = h.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>");
  h = h.replace(/^- (.*)$/gm,"<li>$1</li>").replace(/(<li>.*?<\/li>)/gs,"<ul>$1</ul>");
  h = h.replace(/\n\n/g,"<br><br>").replace(/\n/g,"<br>");
  return h;
}

// ── Session ───────────────────────────────────────────────────────────────────
const sessionId = localStorage.getItem("jardiyn_session_id") ||
  `session_${Math.random().toString(36).slice(2)}_${Date.now()}`;
localStorage.setItem("jardiyn_session_id", sessionId);
window.sessionId = sessionId;

const state = {
  profile: {},
  goals:   new Set(JSON.parse(localStorage.getItem("jardiyn_goals") || "[]")),
  trace:   [],
  pendingPhoto: null,
};

// ── API ───────────────────────────────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type":"application/json", "x-jardiyn-session":sessionId, ...(options.headers||{}) },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error?.message || `Request failed: ${res.status}`);
  return json.data ?? json;
}

// ── Status ────────────────────────────────────────────────────────────────────
function setStatus(key, cls) {
  const el = $(`[data-status="${key}"]`);
  if (!el) return;
  el.classList.remove("ok","warn","err"); el.classList.add(cls);
}
async function loadStatus() {
  try {
    const s = await api("/api/status");
    setStatus("server","ok"); setStatus("tools","ok"); setStatus("store","ok");
    setStatus("claude", s.anthropic_configured && !s.fallback_agent ? "ok" : "warn");
    setStatus("apis",   s.live_apis ? "ok" : "warn");
    addTrace({ type:"status", summary:`${s.fallback_agent?"Fallback intelligence":"Claude live · claude-sonnet-4-6"} · APIs ${s.live_apis?"live":"fallback"} · v${s.version||"—"}` });
  } catch { ["server","claude","apis","tools","store"].forEach(k => setStatus(k,"err")); }
}

// ── Profile ───────────────────────────────────────────────────────────────────
function collectProfile() {
  state.profile = {
    session_id:     sessionId,
    site_name:      $("#siteName")?.value.trim()     || "My Garden",
    zip_code:       $("#zip")?.value.trim()          || "49503",
    soil:           $("#soil")?.value                || "unknown",
    sun:            $("#sun")?.value                 || "full_sun",
    goals:          [...state.goals],
    experience:     $("#experience")?.value          || "some",
    budget:         $("#budget")?.value              || "moderate",
    maintenance:    $("#maintenance")?.value         || "low",
    water_access:   $("#waterAccess")?.value         || "hose",
    drainage:       $("#drainage")?.value            || "unknown",
    known_problems: $("#knownProblems")?.value       || "",
    past_failures:  $("#pastFailures")?.value        || "",
  };
  localStorage.setItem("jardiyn_profile", JSON.stringify(state.profile));
  renderActiveProfile();
  return state.profile;
}
function renderActiveProfile() {
  const p = state.profile;
  const el = $("#activeProfile");
  if (el) el.innerHTML = `<strong>${esc(p.site_name||"My Garden")}</strong><br>ZIP ${esc(p.zip_code||"—")} · ${esc(p.soil||"soil unknown")} · ${esc((p.sun||"").replace("_"," "))}<br>${esc((p.goals||[]).join(", ")||"No goals selected")}`;
}
function restoreProfile() {
  const saved = JSON.parse(localStorage.getItem("jardiyn_profile") || "{}");
  ["siteName","zip","soil","sun","experience","budget","maintenance","waterAccess","drainage","knownProblems","pastFailures"].forEach(id => {
    const key = { siteName:"site_name",zip:"zip_code",waterAccess:"water_access",knownProblems:"known_problems",pastFailures:"past_failures" }[id] || id;
    const val = saved[key]; if (val && $(`#${id}`)) $(`#${id}`).value = val;
  });
  if (saved.goals) state.goals = new Set(saved.goals);
  $$("#goalTags button").forEach(b => b.classList.toggle("active", state.goals.has(b.dataset.goal)));
  collectProfile();
}

// ── Signal stack ──────────────────────────────────────────────────────────────
const SIGNAL_META = {
  weather: { label:"Weather",          cls:"weather" },
  noaa:    { label:"NOAA / NWS",       cls:"noaa"    },
  frost:   { label:"Frost",            cls:"frost"   },
  pollen:  { label:"Pollen",           cls:"pollen"  },
  rain:    { label:"Rain / Watering",  cls:"rain"    },
  soil:    { label:"Soil / Zone",      cls:"soil"    },
};
function metricFor(id, widget) {
  const d = widget?.data || {};
  if (id === "weather") return d.temperature_f ? `${Math.round(d.temperature_f)}°F` : d.summary || "Forecast";
  if (id === "noaa")    return d.active_alerts?.length ? `${d.active_alerts.length} alert${d.active_alerts.length>1?"s":""}` : "Clear";
  if (id === "frost")   return d.level ? `${d.level} risk` : "Low risk";
  if (id === "pollen")  return d.level || "Moderate";
  if (id === "rain")    return typeof d.total_inches==="number" ? `${d.total_inches.toFixed(2)} in` : "Rainfall";
  if (id === "soil")    return d.texture || "Soil";
  return widget?.summary || "Ready";
}
function renderSignalStack(data) {
  const cats = data.categories || [];
  const stack = $("#signalStack");
  if (stack) stack.innerHTML = cats.map(cat => {
    const meta  = SIGNAL_META[cat.id] || { label:cat.label, cls:cat.id };
    const widget = cat.widget || {};
    return `<article class="signal-pill ${esc(meta.cls)}">
      <header><h3>${esc(meta.label)}</h3></header>
      <div class="value">${esc(metricFor(cat.id, widget))}</div>
      <p>${esc(widget.summary || "Checked behind the answer.")}</p>
      <footer>
        <span>${esc(String(widget.mode||"fallback").replace("_"," "))}</span>
        <span>${esc(widget.confidence||"medium")}</span>
      </footer>
    </article>`;
  }).join("");
  if ($("#checkedAt")) $("#checkedAt").textContent = data.checked_at ? `Checked ${new Date(data.checked_at).toLocaleTimeString()}` : "Checked now";
  const first = (data.priorities||[])[0];
  if ($("#nextActionTitle")) $("#nextActionTitle").textContent = first?.title || "Ask JarDIYn to make the call";
  if ($("#nextActionReason")) $("#nextActionReason").textContent = first?.reason || "The signal stack is ready to fold into your answer.";
  if ($("#doList"))    $("#doList").innerHTML    = (data.do_now||[]).map(x=>`<li>${esc(x)}</li>`).join("");
  if ($("#watchList")) $("#watchList").innerHTML = (data.priorities||[]).map(x=>`<li>${esc(x.reason||x)}</li>`).join("");
  if ($("#avoidList")) $("#avoidList").innerHTML = (data.avoid||[]).map(x=>`<li>${esc(x)}</li>`).join("");
  addTrace({ type:"signal_stack", summary:"Weather, NOAA/NWS, Frost, Pollen, Rain/Watering, Soil/Zone checked.", tools:cats.map(c=>c.tool).filter(Boolean) });
}
async function refreshSignals() {
  collectProfile();
  const stack = $("#signalStack");
  if (stack) stack.innerHTML = `<article class="signal-pill"><h3>Checking signals…</h3><p>Weather, NOAA/NWS, frost, pollen, rain, and soil are being aligned.</p></article>`;
  const data = await api("/api/dashboard", { method:"POST", body:JSON.stringify({ profile:state.profile }) });
  renderSignalStack(data);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  $$(`.tabs button`).forEach(b => { b.classList.toggle("active", b.dataset.tab===tab); b.setAttribute("aria-selected", b.dataset.tab===tab); });
  $$(".tab-panel").forEach(p => p.classList.toggle("active", p.id===tab));
  if (tab==="tasks")   loadTasks();
  if (tab==="plants")  loadPlants();
  if (tab==="sources") loadSources();
}

// ── Trace ─────────────────────────────────────────────────────────────────────
function addTrace(entry) {
  state.trace.unshift({ time:new Date().toLocaleTimeString(), ...entry });
  state.trace = state.trace.slice(0, 80);
  renderTrace();
}
function renderTrace() {
  const log = $("#traceLog"); if (!log) return;
  log.innerHTML = state.trace.length
    ? state.trace.map(e =>
        `<div class="trace-entry">
          <strong>${esc(e.type||"event")}</strong><small>${esc(e.time)}</small><br>
          ${esc(e.summary||e.reason||"")}
          ${e.tools?.length ? `<br><span>${esc(e.tools.join(", "))}</span>` : ""}
          ${e.usage ? `<br><span style="color:#4caf50;font-size:10px">↑${e.usage.input_tokens}t ↓${e.usage.output_tokens}t</span>` : ""}
        </div>`).join("")
    : "No trace yet.";
}

// ── Messages ──────────────────────────────────────────────────────────────────
function addMessage(role, text, meta = {}) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  const avatar = `<div class="avatar" aria-hidden="true">${role==="user"?"You":"J"}</div>`;
  const chips  = meta.tools_used?.length
    ? `<div class="trace-chips">${meta.tools_used.map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</div>` : "";
  const dur = meta.duration_ms ? `<div style="font-size:10px;color:#7b725f;margin-top:4px">${(meta.duration_ms/1000).toFixed(1)}s</div>` : "";
  wrap.innerHTML = role==="user"
    ? `<div class="bubble">${md(text)}</div>${avatar}`
    : `${avatar}<div class="bubble">${md(text)}${chips}${dur}</div>`;
  const msgs = $("#messages");
  if (msgs) { msgs.appendChild(wrap); wrap.scrollIntoView({ block:"end", behavior:"smooth" }); }
}

// ── Photo pipeline ────────────────────────────────────────────────────────────
const PHOTO_TYPES = new Set(["image/jpeg","image/png","image/webp","image/gif","image/heic","image/heif"]);

async function normalizePhoto(file) {
  if (!file) throw new Error("No file");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image too large (max 10MB)");
  if (!PHOTO_TYPES.has(file.type) && !file.type.startsWith("image/")) throw new Error(`Unsupported type: ${file.type}`);
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { throw new Error("Could not process this image. Try JPEG or PNG."); }
  const { width:w, height:h } = bmp;
  const scale = Math.min(1, 1600 / Math.max(w, h));
  const tw = Math.round(w * scale), th = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = tw; canvas.height = th;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, tw, th);
  ctx.drawImage(bmp, 0, 0, tw, th);
  bmp.close?.();
  const blob = await new Promise((res,rej) => canvas.toBlob(b => b?res(b):rej(new Error("Encode failed")), "image/jpeg", 0.85));
  const b64  = await new Promise((res,rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(",")[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
  return { base64:b64, media_type:"image/jpeg", width:tw, height:th, bytes:blob.size, preview_url:URL.createObjectURL(blob) };
}

function handlePhotoUpload(file) {
  if (!file) return;
  normalizePhoto(file).then(n => {
    state.pendingPhoto = n;
    const prev = $("#photoPreview"), img = $("#photoPreviewImg"), lbl = $("#photoPreviewLabel");
    if (prev) prev.classList.add("show");
    if (img)  { img.src = n.preview_url; img.alt = `Plant photo ${n.width}×${n.height}`; }
    if (lbl)  lbl.textContent = `Photo ready · ${n.width}×${n.height} · ${Math.round(n.bytes/1024)}KB`;
    const inp = $("#messageInput");
    if (inp && !inp.value.trim()) inp.placeholder = "Describe the symptoms or click Ask JarDIYn.";
  }).catch(err => alert(err.message));
}
function clearPhoto() {
  if (state.pendingPhoto?.preview_url) URL.revokeObjectURL(state.pendingPhoto.preview_url);
  state.pendingPhoto = null;
  const prev = $("#photoPreview"); if (prev) prev.classList.remove("show");
  const inp = $("#messageInput");
  if (inp) inp.placeholder = "Example: Should I water today, plant this weekend, protect seedlings tonight…";
}
window.clearPhoto = clearPhoto;

// ── Send message ───────────────────────────────────────────────────────────────
async function sendMessage(prompt) {
  collectProfile();
  const input = $("#messageInput");
  const message = prompt || input?.value.trim();
  if (!message && !state.pendingPhoto) return;
  if (input && !prompt) input.value = "";
  switchTab("ask");
  addMessage("user", state.pendingPhoto ? `[Photo] ${message||"Diagnose this plant issue."}` : message);
  const pending = document.createElement("div");
  pending.className = "msg";
  pending.innerHTML = `<div class="avatar" aria-hidden="true">J</div><div class="bubble">Checking your site context and signal stack first…</div>`;
  $("#messages")?.appendChild(pending);
  pending.scrollIntoView({ block:"end" });
  try {
    let data;
    if (state.pendingPhoto) {
      const raw = await api("/api/identify", { method:"POST", body:JSON.stringify({ symptoms:message||"Diagnose this plant issue.", image_base64:state.pendingPhoto.base64, image_media_type:state.pendingPhoto.media_type, profile:state.profile }) });
      clearPhoto();
      data = { answer:(raw.result?.summary||raw.result?.diagnosis||JSON.stringify(raw.result)||"Diagnosis complete."), tools_used:raw.result?.tools_used||[], mode:"identify" };
    } else {
      data = await api("/api/chat", { method:"POST", body:JSON.stringify({ message, profile:state.profile, save_suggestions:true }) });
    }
    pending.remove();
    addMessage("assistant", data.answer, data);
    addTrace({ type:"agent", summary:data.mode||"agent run", tools:data.tools_used||[] });
    (data.trace||[]).forEach(item => addTrace({ type:item.type||"tool", summary:item.summary||item.reason||item.stop_reason, tools:item.tools||(item.tool?[item.tool]:undefined), usage:item.usage }));
    if (data.do_now?.length && $("#doList")) {
      $("#doList").innerHTML   = data.do_now.map(x=>`<li>${esc(x)}</li>`).join("");
      $("#watchList").innerHTML= (data.priorities||[]).map(x=>`<li>${esc(x.reason||x)}</li>`).join("");
      $("#avoidList").innerHTML= (data.avoid||[]).map(x=>`<li>${esc(x)}</li>`).join("");
    }
    await loadTasks();
    await updateMemoryMini();
  } catch (err) {
    pending.remove();
    addMessage("assistant", `JarDIYn could not complete that check: ${esc(err.message)}`);
    addTrace({ type:"error", summary:err.message });
  }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
async function loadTasks() {
  try {
    const data  = await api(`/api/tasks?session_id=${encodeURIComponent(sessionId)}`);
    const tasks = data.tasks || [];
    const list  = $("#tasksList");
    if (list) {
      list.innerHTML = tasks.length
        ? tasks.map(t =>
            `<article class="item-card${t.status==="done"?" done":""}">
              <h4>${esc(t.title)}</h4>
              <p>${esc(t.priority)} · ${esc(t.due||"this week")} · ${esc(t.status||"open")}</p>
              ${t.status!=="done" ? `<button class="task-complete" onclick="completeTask('${esc(t.id)}')">Mark done</button>` : ""}
            </article>`).join("")
        : `<div class="item-card">No tasks yet. Ask JarDIYn for a Plan Check or Garden Plan to generate suggested tasks.</div>`;
    }
    return tasks;
  } catch { return []; }
}
async function completeTask(id) {
  await api(`/api/tasks/${id}/complete`, { method:"POST" });
  await loadTasks();
  await updateMemoryMini();
}
async function updateMemoryMini() {
  try {
    const tasks = await loadTasks();
    const mini  = $("#memoryMini");
    if (mini) {
      const open = tasks.filter(t => t.status!=="done").slice(0, 4);
      mini.innerHTML = open.length ? open.map(t=>`• ${esc(t.title)}`).join("<br>") : "No pending tasks.";
    }
  } catch {}
}
window.completeTask = completeTask;

// ── Plants ────────────────────────────────────────────────────────────────────
async function loadPlants() {
  try {
    const data   = await api(`/api/plants?session_id=${encodeURIComponent(sessionId)}`);
    const plants = data.plants || [];
    const list   = $("#plantsList");
    if (list) {
      list.innerHTML = plants.length
        ? plants.map(p =>
            `<article class="item-card">
              <h4>${esc(p.name)}</h4>
              <p><em>${esc(p.botanical||"")}</em><br>${esc(p.location||"garden")} · ${esc(p.notes||"")}</p>
            </article>`).join("")
        : `<div class="item-card">No tracked plants yet. Ask JarDIYn to diagnose or look up a plant to start tracking.</div>`;
    }
  } catch {}
}

// ── Sources ───────────────────────────────────────────────────────────────────
async function loadSources() {
  try {
    const [sources, tools] = await Promise.all([api("/api/sources"), api("/api/tools")]);
    const list = $("#sourcesList"); if (!list) return;
    list.innerHTML =
      (sources.sources||[]).map(s =>
        `<article class="item-card"><h4>${esc(s.category)}</h4><p><strong>${esc(s.name)}</strong><br>${esc(s.mode)} · ${esc(s.endpoint)}<br><em>${esc(s.freshness)}</em></p></article>`
      ).join("") +
      Object.values(tools.categories||{}).map(c =>
        `<article class="item-card"><h4>${esc(c.label||"")}</h4><p>${esc(c.description||"")}<br><em>${(c.tools||[]).map(t=>esc(t.name)).join(", ")}</em></p></article>`
      ).join("");
  } catch {}
}

// ── Plan prompts ──────────────────────────────────────────────────────────────
function planPrompt(kind) {
  const map = {
    check:   "Run a Plan Check before I act. Fold weather, NOAA/NWS, frost, pollen, rainfall, soil, zone, goals, known problems, and past failures into one recommendation.",
    weekly:  "Generate this week's Garden Plan from my site context and current conditions. Convert it into practical tasks.",
    weekend: "Build a weekend work plan. Respect weather windows, NOAA/NWS alerts, frost, pollen, rainfall, soil moisture, and maintenance level.",
  };
  return map[kind] || map.weekly;
}

// ── Demo Mode — 10 scenarios ──────────────────────────────────────────────────
const DEMOS = {
  "grand-rapids": {
    num:"01", title:"Grand Rapids — Pollinator Bed", cat:"Climate stress",
    desc:"Zone 6a clay loam, spring wet spots, converting a low bed to native pollinators.",
    profile:{ site_name:"Grand Rapids Pollinator Bed", zip_code:"49503", soil:"clay loam", sun:"full_sun", goals:["pollinators","native plants","low maintenance"], known_problems:"heavy clay, spring wet spots", past_failures:"lavender rotted in low bed" },
    prompts:[
      "What should I do in my garden this week? Check weather, NOAA/NWS, frost, pollen, rain, and soil first.",
      "Can I plant native perennials in this clay bed right now, or should I wait?",
      "My coneflowers have yellowing leaves. What's likely wrong?",
      "Should I water today? It rained two days ago and clay holds moisture.",
      "Run a Plan Check before I spend money at the nursery this weekend.",
    ],
  },
  "sf": {
    num:"02", title:"San Francisco — Container Garden", cat:"Small space",
    desc:"Zone 10a, fog and wind, container herbs on a west-facing deck.",
    profile:{ site_name:"SF Container Garden", zip_code:"94103", soil:"loam", sun:"partial_shade", goals:["herbs","low maintenance"], known_problems:"wind, fog, containers dry unevenly" },
    prompts:[
      "Should I water my containers today? Fog has been heavy all week.",
      "Which herbs actually thrive in San Francisco's microclimate?",
      "My basil keeps getting leggy and pale. Light problem or overwatering?",
      "Is there frost risk this week for my deck containers?",
      "What should I plant in containers for late summer in SF?",
    ],
  },
  "austin": {
    num:"03", title:"Austin — Heat Garden", cat:"Climate stress",
    desc:"Zone 9a, clay loam, establishing a drought-tolerant native bed during heat.",
    profile:{ site_name:"Austin Heat Garden", zip_code:"78701", soil:"clay loam", sun:"full_sun", goals:["native plants","low maintenance"], known_problems:"heat, drought, compacted soil" },
    prompts:[
      "It has been over 100°F for a week. What should I do right now?",
      "Should I water today or skip it? My clay holds moisture for a while.",
      "What native Texas plants handle full sun and heat?",
      "My crape myrtle leaves are curling. Heat stress or something else?",
      "Is now a good time to plant, or should I wait until fall?",
    ],
  },
  "west-palm": {
    num:"04", title:"West Palm — Sandy Storm Border", cat:"Climate stress",
    desc:"Zone 10b, sandy soil, fast-draining pollinator border during storm season.",
    profile:{ site_name:"West Palm Sandy Border", zip_code:"33401", soil:"sandy", sun:"full_sun", goals:["pollinators","cut flowers"], known_problems:"fast drainage, storm season" },
    prompts:[
      "Storm season has started. What should I do to prepare my garden?",
      "My sandy soil dries out within hours. How do I fix this?",
      "What plants survive South Florida heat and storm flooding?",
      "Should I water today or will the afternoon storm handle it?",
      "My zinnias wilt by noon even with watering. What is wrong?",
    ],
  },
  "nyc": {
    num:"05", title:"NYC — Urban Shade Garden", cat:"Small space",
    desc:"Zone 7b, north-facing, reflected heat from buildings, small city space.",
    profile:{ site_name:"NYC Urban Shade", zip_code:"10001", soil:"loam", sun:"partial_shade", goals:["native plants","low maintenance"], known_problems:"shade, reflected heat, small space" },
    prompts:[
      "What should I do in my NYC garden this week?",
      "What plants thrive in deep city shade with reflected heat?",
      "Is there a good planting window coming up this week?",
      "My hostas have brown crispy edges. Sunburn, underwatering, or soil?",
      "Should I fertilize now or wait? One small raised bed in partial shade.",
    ],
  },
  "raised-bed": {
    num:"06", title:"Raised Bed — Food Garden", cat:"Food",
    desc:"Zone 6b, four new 4×8 beds, drip irrigation, maximizing vegetable yield.",
    profile:{ site_name:"Raised Bed Food Garden", zip_code:"43215", soil:"sandy loam", sun:"full_sun", goals:["vegetables","herbs"], known_problems:"first season, compacted soil underneath", water_access:"drip" },
    prompts:[
      "I have four new raised beds. What should I plant right now for my zone?",
      "Should I water today or let the drip system handle it after recent rain?",
      "My tomato leaves have curled edges. Watering or temperature problem?",
      "Can I plant a second crop in my lettuce beds now that it is bolting?",
      "Run a Plan Check before I buy fall transplants.",
    ],
  },
  "pollinator-native": {
    num:"07", title:"Native Conversion — Prairie", cat:"Ecology",
    desc:"Zone 6a, converting 800sf of lawn to native prairie, year one establishment.",
    profile:{ site_name:"Native Prairie Conversion", zip_code:"53202", soil:"clay loam", sun:"full_sun", goals:["native plants","pollinators","low maintenance"], known_problems:"former lawn, compacted clay, weed pressure" },
    prompts:[
      "I am converting lawn to natives. What should I focus on this week?",
      "My newly planted coneflowers look stressed after transplanting. What is wrong?",
      "How do I tell the difference between native seedlings and weeds in year one?",
      "Is now a good time to direct sow native seeds?",
      "Run a Plan Check for establishing natives in a former lawn.",
    ],
  },
  "community": {
    num:"08", title:"Community Garden — 10×10 Plot", cat:"Food",
    desc:"Zone 6b, weekend visits only, shared tools, maximizing yield with limited access.",
    profile:{ site_name:"Community Garden Plot", zip_code:"60601", soil:"loam", sun:"full_sun", goals:["vegetables","herbs"], known_problems:"weekend-only visits, shared tools", water_access:"sprinkler" },
    prompts:[
      "I can only visit on weekends. What should I check and do this Saturday?",
      "My neighbor says there is aphid pressure nearby. What should I do proactively?",
      "Is it worth planting fall crops in my 10×10 plot this late?",
      "The shared sprinkler has been running. Should I still water my plot?",
      "What are the highest-yield vegetables for a small plot I cannot visit daily?",
    ],
  },
  "deer-pressure": {
    num:"09", title:"Heavy Deer Pressure — 3 Acres", cat:"Site challenge",
    desc:"Zone 6b, no fence possible, severe browse damage, designing around deer.",
    profile:{ site_name:"High Deer Property", zip_code:"07930", soil:"silt loam", sun:"partial_shade", goals:["native plants","low maintenance"], known_problems:"severe deer browse, steep slope, no fence possible", past_failures:"hostas and daylilies eaten to ground" },
    prompts:[
      "Deer ate everything last night again. What deer-resistant plants actually work?",
      "When are deer most active and what conditions make it worse?",
      "Is there a planting window this week to put in new shrubs?",
      "My ferns are being browsed for the first time. Why now?",
      "Run a Plan Check for a deer-resistant native planting scheme.",
    ],
  },
  "inspired": {
    num:"10", title:"Inspired by Public Gardens", cat:"Design",
    desc:"Zone 6b, came home from Longwood or Chanticleer, starting from lawn.",
    profile:{ site_name:"Inspired Residential Garden", zip_code:"19348", soil:"silt loam", sun:"full_sun", goals:["cut flowers","pollinators","native plants"], experience:"some", budget:"generous", known_problems:"starting from scratch, grass lawn, no existing beds" },
    prompts:[
      "I just visited Chanticleer and want something beautiful. Where do I start?",
      "What plants from great public gardens actually work at home scale?",
      "Is now the right time to start building planting beds?",
      "I want year-round interest. What is the framework for that?",
      "Run a Plan Check before I hire a landscaper.",
    ],
  },
  "drought-restrictions": {
    num:"11", title:"Drought & Water Restrictions", cat:"Climate stress",
    desc:"Zone 9b, mandatory watering days, keeping a garden alive on a budget.",
    profile:{ site_name:"Drought Survival Garden", zip_code:"95814", soil:"clay loam", sun:"full_sun", goals:["low maintenance","native plants"], known_problems:"two-day-a-week watering limit, extended drought", water_access:"hose" },
    prompts:[
      "We're on a two-day watering restriction. How do I keep my garden alive?",
      "Which of my plants should I prioritize if I can't water everything?",
      "What's the most water-efficient way to water on my allowed days?",
      "Should I let my lawn go dormant to save the beds?",
      "Run a Plan Check for a drought-tolerant redesign.",
    ],
  },
  "new-homeowner": {
    num:"12", title:"New Homeowner — Blank Slate", cat:"Design",
    desc:"Zone 5b, just bought the house, inherited overgrown beds, no idea where to start.",
    profile:{ site_name:"New Home Garden", zip_code:"55104", soil:"unknown", sun:"full_sun", goals:["low maintenance"], experience:"beginner", known_problems:"inherited overgrown beds, unknown plants, first garden ever" },
    prompts:[
      "I just bought a house with overgrown beds. Where do I even start?",
      "How do I figure out what plants I already have before I rip anything out?",
      "What's the lowest-effort way to make the yard look maintained this season?",
      "Should I do anything right now or wait and observe for a year?",
      "Run a Plan Check for a first-time homeowner garden.",
    ],
  },
  "fall-bulbs": {
    num:"13", title:"Fall Planting & Bulbs", cat:"Seasonal",
    desc:"Zone 6a, autumn, planting bulbs and getting beds ready for winter.",
    profile:{ site_name:"Fall Bulb Garden", zip_code:"02138", soil:"loam", sun:"full_sun", goals:["cut flowers","pollinators"], known_problems:"want spring color, squirrels dig up bulbs" },
    prompts:[
      "Is it the right time to plant spring bulbs in my zone?",
      "How deep and how do I stop squirrels from digging up my bulbs?",
      "What should I cut back versus leave standing for winter?",
      "Should I plant anything else this fall for spring impact?",
      "Run a Plan Check for fall bed preparation.",
    ],
  },
  "balcony": {
    num:"14", title:"Apartment Balcony", cat:"Small space",
    desc:"Zone 7a, 4th-floor balcony, wind exposure, containers only.",
    profile:{ site_name:"Balcony Garden", zip_code:"20009", soil:"loam", sun:"partial_shade", goals:["herbs","cut flowers"], known_problems:"high wind, weight limits, containers only, half-day sun", water_access:"hand" },
    prompts:[
      "What can I actually grow on a windy 4th-floor balcony?",
      "My container plants dry out and blow over. How do I fix both?",
      "Should I water today given the wind and my half-day sun?",
      "What's the best low-weight setup for a balcony garden?",
      "Run a Plan Check for a container balcony garden.",
    ],
  },
  "rain-garden": {
    num:"15", title:"Drainage & Rain Garden", cat:"Site challenge",
    desc:"Zone 6b, low spot that floods, exploring a rain garden solution.",
    profile:{ site_name:"Rain Garden Project", zip_code:"44113", soil:"clay", sun:"partial_shade", goals:["native plants","pollinators"], known_problems:"low spot floods after rain, standing water, heavy clay" },
    prompts:[
      "I have a low spot that floods after every rain. Is a rain garden the answer?",
      "What native plants tolerate both flooding and dry spells?",
      "How has the recent rainfall affected my standing-water problem?",
      "Should I amend the clay or work with it?",
      "Run a Plan Check for a rain garden in heavy clay.",
    ],
  },
  "veg-disease": {
    num:"16", title:"Vegetable Disease Outbreak", cat:"Diagnosis",
    desc:"Zone 7b, mid-summer, multiple vegetables showing symptoms at once.",
    profile:{ site_name:"Vegetable Garden Crisis", zip_code:"27601", soil:"sandy loam", sun:"full_sun", goals:["vegetables"], known_problems:"humid summer, multiple plants declining, possible disease spread" },
    prompts:[
      "Several of my vegetables are declining at once. Is this a disease spreading?",
      "My tomato leaves are spotting and my squash has white patches. Related?",
      "How do I stop whatever this is from spreading to healthy plants?",
      "Is the humid weather making this worse, and what do conditions say?",
      "Run a Plan Check for managing a disease outbreak.",
    ],
  },
  "pollinator-decline": {
    num:"17", title:"Bringing Back Pollinators", cat:"Ecology",
    desc:"Zone 5b, noticed fewer bees and butterflies, wants to rebuild habitat.",
    profile:{ site_name:"Pollinator Recovery Garden", zip_code:"53703", soil:"loam", sun:"full_sun", goals:["pollinators","native plants","cut flowers"], known_problems:"declining bee and butterfly activity, mostly non-native plants now" },
    prompts:[
      "I'm seeing way fewer bees and butterflies. How do I bring them back?",
      "What native plants give pollinators the most support in my zone?",
      "How's the pollen and bloom timing looking for pollinator activity right now?",
      "What am I doing that might be hurting pollinators without realizing it?",
      "Run a Plan Check for a pollinator recovery plan.",
    ],
  },
  "shade-trees": {
    num:"18", title:"Planting Under Shade Trees", cat:"Site challenge",
    desc:"Zone 6a, dry shade under mature oaks, nothing will grow.",
    profile:{ site_name:"Dry Shade Garden", zip_code:"63108", soil:"loam", sun:"full_shade", goals:["native plants","low maintenance"], known_problems:"dry shade under mature oaks, root competition, bare ground" },
    prompts:[
      "Nothing grows under my big oak trees. What actually works in dry shade?",
      "How do I plant without damaging the tree roots?",
      "Is there a planting window coming up that would help things establish?",
      "Should I amend the soil or pick plants that tolerate it as-is?",
      "Run a Plan Check for dry shade under mature trees.",
    ],
  },
};

function openDemo() {
  const grid    = $("#demoGrid");
  const overlay = $("#demoOverlay");
  if (!grid || !overlay) return;
  // Group by category so the library stays navigable as it scales
  const byCat = {};
  Object.entries(DEMOS).forEach(([id,s]) => { const c=s.cat||"More"; (byCat[c]=byCat[c]||[]).push([id,s]); });
  grid.style.display = "block";
  grid.innerHTML = Object.entries(byCat).map(([cat,items]) =>
    `<div class="demo-cat-group">
      <div class="demo-cat-label">${esc(cat)}</div>
      <div class="demo-cat-cards">
        ${items.map(([id,s]) =>
          `<button class="demo-card" id="dc-${id}" onclick="selectScenario('${id}')">
            <div class="demo-card-num">${esc(s.num)}</div>
            <div class="demo-card-title">${esc(s.title)}</div>
            <div class="demo-card-desc">${esc(s.desc)}</div>
          </button>`).join("")}
      </div>
    </div>`
  ).join("");
  $("#demoPrompts")?.classList.remove("open");
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeDemo() {
  $("#demoOverlay")?.classList.remove("open");
  document.body.style.overflow = "";
}
window.selectScenario = function(id) {
  $$(".demo-card").forEach(c => c.classList.remove("active"));
  $(`#dc-${id}`)?.classList.add("active");
  const s = DEMOS[id]; if (!s) return;
  const lbl  = $("#demoPromptsLabel"); if (lbl) lbl.textContent = s.title;
  const list = $("#demoPromptList");
  if (list) list.innerHTML = (s.prompts||[]).map(p =>
    `<button class="demo-prompt-btn" onclick="fireScenario('${id}',${JSON.stringify(p).replace(/'/g,"\\'")})">${esc(p)}</button>`
  ).join("");
  const panel = $("#demoPrompts");
  if (panel) { panel.classList.add("open"); panel.scrollIntoView({ behavior:"smooth", block:"nearest" }); }
};
window.fireScenario = function(id, prompt) {
  const s = DEMOS[id]; if (!s?.profile) return;
  const p = s.profile;
  if (p.site_name && $("#siteName"))   $("#siteName").value   = p.site_name;
  if (p.zip_code  && $("#zip"))        $("#zip").value        = p.zip_code;
  if (p.soil      && $("#soil"))       $("#soil").value       = p.soil;
  if (p.sun       && $("#sun"))        $("#sun").value        = p.sun;
  if (p.known_problems && $("#knownProblems")) $("#knownProblems").value = p.known_problems;
  if (p.past_failures  && $("#pastFailures"))  $("#pastFailures").value  = p.past_failures;
  if (p.goals) {
    state.goals = new Set(p.goals);
    localStorage.setItem("jardiyn_goals", JSON.stringify([...state.goals]));
    $$("#goalTags button").forEach(b => b.classList.toggle("active", state.goals.has(b.dataset.goal)));
  }
  collectProfile();
  closeDemo();
  switchTab("ask");
  setTimeout(() => sendMessage(prompt), 200);
};

// ── Situational Awareness Engine ──────────────────────────────────────────────
let _cond = null, _shown = new Set();

async function fetchCond(zip) {
  if (!zip) return null;
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${zip}&count=1&format=json`);
    const geo    = await geoRes.json();
    const loc    = geo.results?.[0]; if (!loc) return null;
    const [wRes,pRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,weathercode&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&temperature_unit=fahrenheit&forecast_days=7`),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.latitude}&longitude=${loc.longitude}&hourly=grass_pollen,birch_pollen,mugwort_pollen&forecast_days=1`),
    ]);
    const w=await wRes.json(), p=await pRes.json();
    const cur=w.current||{}, d=w.daily||{};
    const minT=(d.temperature_2m_min||[]).filter(v=>v!=null);
    const maxT=(d.temperature_2m_max||[]).filter(v=>v!=null);
    const prec=(d.precipitation_sum||[]);
    const wc  =(d.weathercode||[]);
    const c={
      loc,zip,currentTemp:Math.round(cur.temperature_2m||0),humidity:cur.relative_humidity_2m||0,
      minNext3:minT.length?Math.min(...minT.slice(0,3)):40,
      maxNext3:maxT.length?Math.max(...maxT.slice(0,3)):75,
      maxNext7:maxT.length?Math.max(...maxT):75,
      stormToday:wc.slice(0,2).some(v=>v>=95),
      noRain:prec.slice(0,7).every(v=>(v||0)<0.1),
      rain7:prec.slice(0,7).reduce((a,b)=>a+(b||0),0),
      grass:p.hourly?.grass_pollen?.[12]||0,
      birch:p.hourly?.birch_pollen?.[12]||0,
      weed:p.hourly?.mugwort_pollen?.[12]||0,
    };
    c.maxPollen=Math.max(c.grass,c.birch,c.weed);
    c.freeze=c.minNext3<=28; c.frost=c.minNext3<=35&&!c.freeze;
    c.heatWave=c.maxNext3>=95; c.hotSpell=c.maxNext7>=90&&!c.heatWave;
    _cond=c; return c;
  } catch(e){console.warn("[cond]",e.message);return null;}
}

function buildAlerts(c,p) {
  if(!c) return [];
  const pl=(p?.goals||[]).join(", ")||"your garden";
  const z=p?.hardiness_zone?` in Zone ${p.hardiness_zone}`:"";
  const a=[];
  if(c.freeze)  a.push({id:"freeze",urgency:"red",icon:"🧊",title:`Freeze warning — ${c.minNext3}°F expected`,desc:`Temperatures dropping to ${c.minNext3}°F within 72 hours. Tender plants and containers are at risk.`,prompt:`URGENT: Freeze warning — ${c.minNext3}°F forecast. I grow ${pl}${z}. Which plants need protection tonight, what to cover, what to bring inside, and should I water before the freeze?`,action:"Get freeze protection plan →"});
  else if(c.frost) a.push({id:"frost",urgency:"amber",icon:"🌡️",title:`Frost watch — lows near ${c.minNext3}°F`,desc:`Near-freezing forecast. Check tender plants, seedlings, and containers.`,prompt:`Frost watch — ${c.minNext3}°F forecast. I grow ${pl}${z}. Which plants are most vulnerable and what should I do today?`,action:"Check frost risk →"});
  if(c.heatWave) a.push({id:"heatwave",urgency:"red",icon:"🔥",title:`Heat wave — ${c.maxNext3}°F expected`,desc:`Extreme heat in 3 days. Vegetables and containers are at highest risk.`,prompt:`Heat wave — ${c.maxNext3}°F in 3 days. I grow ${pl}. Which plants are most at risk? Watering schedule, shade, and what not to do.`,action:"Get heat wave action plan →"});
  else if(c.hotSpell) a.push({id:"hotspell",urgency:"amber",icon:"☀️",title:`Hot week ahead — up to ${c.maxNext7}°F`,desc:`Above-average heat. Adjust watering and watch for stress signs.`,prompt:`Hot week — ${c.maxNext7}°F. I grow ${pl}. How should I adjust watering and what stress signs should I watch for?`,action:"Adjust for the heat →"});
  if(c.stormToday) a.push({id:"storm",urgency:"red",icon:"⛈️",title:"Storm approaching — act before it hits",desc:"Thunderstorm forecast today or tonight. Staked plants and containers need attention.",prompt:`Thunderstorm incoming. I grow ${pl}. What should I do right now — staking, harvesting, moving containers? Give me a 30-minute checklist.`,action:"Pre-storm checklist →"});
  if(c.noRain&&c.maxNext7>80) a.push({id:"drought",urgency:"amber",icon:"🏜️",title:"Dry stretch — watering critical",desc:`No rain forecast with ${c.maxNext7}°F highs. Soil moisture will drop fast.`,prompt:`Dry week — ${c.maxNext7}°F, no rain. I grow ${pl}. Specific watering plan: when, how deep, signs of stress, and whether to mulch.`,action:"Build a watering plan →"});
  if(c.maxPollen>100){const pt=c.grass>c.birch&&c.grass>c.weed?"grass":c.birch>c.weed?"tree":"weed";a.push({id:"pollen",urgency:"amber",icon:"🌸",title:`High ${pt} pollen today`,desc:"Elevated pollen affects outdoor work timing and pollinator plants.",prompt:`High ${pt} pollen today. I grow ${pl}. What does this mean for my garden and when is the best time to work outside?`,action:"What this means for your garden →"});}
  if(!c.freeze&&!c.heatWave&&!c.stormToday&&c.maxNext3<85&&c.minNext3>40&&c.rain7>0.5) a.push({id:"planting",urgency:"green",icon:"🌱",title:"Good planting window this week",desc:`Mild temps (${c.minNext3}–${c.maxNext3}°F) with some rain forecast. Ideal for transplanting.`,prompt:`Great planting window — highs ${c.maxNext3}°F, lows ${c.minNext3}°F, rain coming. I grow ${pl}${z}. What should I plant or transplant this week?`,action:"What to plant this week →"});
  return a;
}

function pushAlert(alert) {
  if(_shown.has(alert.id)) return; _shown.add(alert.id);
  const stack=$("#notifStack"); if(!stack) return;
  const ts=new Date().toLocaleTimeString("en",{hour:"numeric",minute:"2-digit"});
  const card=document.createElement("div");
  card.className="notif-card"; card.id=`notif-${alert.id}`;
  card.innerHTML=`<div class="notif-stripe ${alert.urgency}"></div><div class="notif-body"><div class="notif-header"><div class="notif-icon">${alert.icon}</div><div class="notif-title">${esc(alert.title)}</div><button class="notif-dismiss" onclick="dismissAlert('${alert.id}')" aria-label="Dismiss">✕</button></div><div class="notif-desc">${esc(alert.desc)}</div><button class="notif-action" onclick="fireAlert(${JSON.stringify(alert.prompt).replace(/'/g,"\\'")},'${alert.id}')"><span class="notif-action-arrow">→</span>${esc(alert.action)}</button><div class="notif-time">Live conditions · ${ts}</div></div>`;
  stack.appendChild(card);
  requestAnimationFrame(()=>requestAnimationFrame(()=>card.classList.add("show")));
  if(alert.urgency==="green") setTimeout(()=>dismissAlert(alert.id),12000);
  if(alert.urgency==="red"&&"Notification" in window){
    const fire=()=>new Notification(`JarDIYn — ${alert.title}`,{body:alert.desc,tag:alert.id});
    if(Notification.permission==="granted") fire();
    else if(Notification.permission==="default") Notification.requestPermission().then(p=>{if(p==="granted") fire();});
  }
}
window.dismissAlert = function(id) {
  const card=document.getElementById(`notif-${id}`); if(!card) return;
  card.classList.add("hide"); setTimeout(()=>card.remove(),300);
};
window.fireAlert = function(prompt, id) {
  dismissAlert(id); switchTab("ask"); setTimeout(()=>sendMessage(prompt),150);
};
async function runAwareness() {
  collectProfile();
  const zip=state.profile.zip_code; if(!zip||zip==="00000") return;
  const c=await fetchCond(zip); if(!c) return;
  const alerts=buildAlerts(c,state.profile);
  ["red","amber","green"].forEach(u=>alerts.filter(a=>a.urgency===u).forEach((a,i)=>setTimeout(()=>pushAlert(a),i*700)));
}

// ── Wire ──────────────────────────────────────────────────────────────────────
function wire() {
  // Tabs
  $$(`.tabs button`).forEach(b => b.addEventListener("click", ()=>switchTab(b.dataset.tab)));

  // All data-prompt and data-plan-action buttons
  $$("[data-prompt]").forEach(b => b.addEventListener("click", ()=>{ switchTab("ask"); sendMessage(b.dataset.prompt); }));
  $$("[data-plan-action]").forEach(b => b.addEventListener("click", ()=>{ switchTab("ask"); sendMessage(planPrompt(b.dataset.planAction)); }));

  // Goal tags
  $$("#goalTags button").forEach(b => b.addEventListener("click", ()=>{
    state.goals.has(b.dataset.goal) ? state.goals.delete(b.dataset.goal) : state.goals.add(b.dataset.goal);
    localStorage.setItem("jardiyn_goals", JSON.stringify([...state.goals]));
    b.classList.toggle("active"); collectProfile();
  }));

  // Profile inputs
  ["siteName","zip","soil","sun","experience","budget","maintenance","waterAccess","drainage","knownProblems","pastFailures"]
    .forEach(id => $(`#${id}`)?.addEventListener("change", collectProfile));

  // Refresh / zone
  $("#refreshDashboard")?.addEventListener("click", refreshSignals);
  $("#zoneBtn")?.addEventListener("click", ()=>{ collectProfile(); refreshSignals(); });

  // Send
  $("#sendBtn")?.addEventListener("click", ()=>sendMessage());
  $("#messageInput")?.addEventListener("keydown", e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} });

  // Photo — in explore mode, open sample picker instead of the file dialog
  const photoLabel = document.querySelector('label[for="photoUpload"]');
  photoLabel?.addEventListener("click", e=>{ if(exploreMode){ e.preventDefault(); openSamplePlants(); } });
  $("#photoUpload")?.addEventListener("change", e=>handlePhotoUpload(e.target.files[0]));

  // Welcome / onboarding
  $("#welcomeZipGo")?.addEventListener("click", welcomeLoadZip);
  $("#welcomeZip")?.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); welcomeLoadZip(); } });
  $("#welcomeDemoPath")?.addEventListener("click", ()=>{ hideWelcome(); openDemo(); });
  $("#welcomeExplorePath")?.addEventListener("click", enterExplore);
  $("#welcomeSkip")?.addEventListener("click", ()=>{ hideWelcome(); $("#siteName")?.focus(); });
  $("#exploreBuildBtn")?.addEventListener("click", exitExplore);
  // Re-open welcome from the brand mark
  document.querySelector(".topbar .brand")?.addEventListener("click", showWelcome);

  // Sample plants
  $("#sampleClose")?.addEventListener("click", closeSamplePlants);
  $("#sampleOverlay")?.addEventListener("click", e=>{ if(e.target==$("#sampleOverlay")) closeSamplePlants(); });

  // Trace
  $("#traceToggle")?.addEventListener("click", ()=>$(".app-shell")?.classList.toggle("trace-open"));
  $("#closeTrace")?.addEventListener("click",  ()=>$(".app-shell")?.classList.remove("trace-open"));

  // Mobile sidebar
  $("#mobileMenu")?.addEventListener("click", ()=>{ $("#sidebar")?.classList.add("open"); $("#overlay")?.classList.add("show"); });
  $("#overlay")?.addEventListener("click",   ()=>{ $("#sidebar")?.classList.remove("open"); $("#overlay")?.classList.remove("show"); });

  // Demo
  $("#demoBtn")?.addEventListener("click", openDemo);
  $("#demoClose")?.addEventListener("click", closeDemo);
  $("#demoOverlay")?.addEventListener("click", e=>{ if(e.target==$("#demoOverlay")) closeDemo(); });

  // Add task / plant
  $("#addTaskBtn")?.addEventListener("click", async ()=>{
    const title=prompt("Task title:"); if(!title) return;
    await api("/api/tasks",{method:"POST",body:JSON.stringify({title,priority:"medium",due:"this week"})});
    await loadTasks();
  });
  $("#addPlantBtn")?.addEventListener("click", async ()=>{
    const name=prompt("Plant name:"); if(!name) return;
    await api("/api/plants",{method:"POST",body:JSON.stringify({name,notes:"Manually tracked"})});
    await loadPlants();
  });

  // Sources
  $("#reloadSources")?.addEventListener("click", loadSources);
}

// ═══════════════════════════════════════════════════════════════════════════
// WELCOME / ONBOARDING — three entry paths
// ═══════════════════════════════════════════════════════════════════════════
let exploreMode = false;

function showWelcome() { $("#welcomeScreen")?.classList.add("show"); }
function hideWelcome() {
  $("#welcomeScreen")?.classList.remove("show");
  localStorage.setItem("jardiyn_onboarded", "1");
}

// ── Real, verifiable live-conditions loader with trace ──────────────────────
// Every call is a genuine HTTP request; the trace shows status + timing.
async function loadLiveConditionsTraced(query, logFn) {
  const isZip = /^\d{5}$/.test(query.trim());
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=1&language=en&format=json`;

  logFn(`→ Geocoding "${query}" · geocoding-api.open-meteo.com`, "api");
  let t = performance.now();
  let loc;
  try {
    const r = await fetch(geoUrl);
    const j = await r.json();
    loc = j.results?.[0];
    logFn(`✓ ${r.status} ${r.statusText} · ${Math.round(performance.now()-t)}ms`, "ok");
  } catch (e) { logFn(`✗ Geocoding failed: ${e.message}`, "error"); return null; }
  if (!loc) { logFn(`✗ Could not find "${query}". Try a ZIP code or "City, ST".`, "error"); return null; }
  logFn(`  ${loc.name}, ${loc.admin1||""} · ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`, "info");

  const lat = loc.latitude, lon = loc.longitude;

  // Weather (current + 7-day)
  logFn(`→ Weather forecast · api.open-meteo.com`, "api");
  t = performance.now();
  let w = {};
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weathercode,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=10`);
    w = await r.json();
    logFn(`✓ ${r.status} · current ${Math.round(w.current?.temperature_2m)}°F · ${Math.round(performance.now()-t)}ms`, "ok");
  } catch (e) { logFn(`✗ Weather failed: ${e.message}`, "error"); }

  // Pollen
  logFn(`→ Air quality / pollen · air-quality-api.open-meteo.com`, "api");
  t = performance.now();
  let p = {};
  try {
    const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=grass_pollen,birch_pollen,mugwort_pollen,alder_pollen,ragweed_pollen&forecast_days=1`);
    p = await r.json();
    logFn(`✓ ${r.status} · ${Math.round(performance.now()-t)}ms`, "ok");
  } catch (e) { logFn(`✗ Pollen failed: ${e.message}`, "error"); }

  // NOAA alerts (real, weather.gov)
  logFn(`→ NOAA active alerts · api.weather.gov`, "api");
  t = performance.now();
  let noaa = { features: [] };
  try {
    const r = await fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: { "Accept":"application/geo+json" } });
    if (r.ok) { noaa = await r.json(); logFn(`✓ ${r.status} · ${noaa.features?.length||0} active alert(s) · ${Math.round(performance.now()-t)}ms`, "ok"); }
    else { logFn(`· ${r.status} (no NOAA coverage for this point)`, "info"); }
  } catch (e) { logFn(`· NOAA unavailable: ${e.message}`, "info"); }

  // Assemble
  const d = w.daily || {};
  const minT = (d.temperature_2m_min||[]).filter(v=>v!=null);
  const maxT = (d.temperature_2m_max||[]).filter(v=>v!=null);
  const prec = (d.precipitation_sum||[]);
  const cur  = w.current || {};
  const h    = p.hourly || {};
  const grass=h.grass_pollen?.[12]||0, birch=h.birch_pollen?.[12]||0, weed=h.mugwort_pollen?.[12]||0, ragweed=h.ragweed_pollen?.[12]||0, alder=h.alder_pollen?.[12]||0;
  const maxPollen = Math.max(grass,birch,weed,ragweed,alder);

  const cond = {
    loc, lat, lon, query, isZip,
    city: loc.name, state: loc.admin1, zip: isZip ? query.trim() : "",
    currentTemp: Math.round(cur.temperature_2m||0),
    humidity: cur.relative_humidity_2m||0,
    wind: Math.round(cur.wind_speed_10m||0),
    wcode: cur.weathercode||0,
    minNext3: minT.length?Math.min(...minT.slice(0,3)):40,
    maxNext3: maxT.length?Math.max(...maxT.slice(0,3)):75,
    maxNext7: maxT.length?Math.max(...maxT):75,
    forecast10: maxT.map((mx,i)=>({day:i,max:Math.round(mx),min:Math.round(minT[i]??mx-15),precip:prec[i]??0,code:d.weathercode?.[i]??0})),
    stormToday: (d.weathercode||[]).slice(0,2).some(v=>v>=95),
    noRain: prec.slice(0,7).every(v=>(v||0)<0.1),
    rain7: prec.slice(0,7).reduce((a,b)=>a+(b||0),0),
    grass, birch, weed, ragweed, alder, maxPollen,
    noaaAlerts: (noaa.features||[]).map(f=>({event:f.properties?.event, severity:f.properties?.severity, headline:f.properties?.headline})),
  };
  cond.maxPollen = maxPollen;
  cond.freeze   = cond.minNext3 <= 28;
  cond.frost    = cond.minNext3 <= 35 && !cond.freeze;
  cond.heatWave = cond.maxNext3 >= 95;
  cond.hotSpell = cond.maxNext7 >= 90 && !cond.heatWave;
  _cond = cond;

  logFn(`✓ Live conditions assembled for ${cond.city} — 6 signals ready`, "done");
  return cond;
}

const WCODE = {0:"Clear",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Rime fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Showers",81:"Heavy showers",95:"Thunderstorm",96:"Storm w/ hail",99:"Severe storm"};
function pollenLabel(v){ return v<10?"Low":v<50?"Moderate":v<150?"High":"Very high"; }

// Render the signal stack from REAL client-fetched conditions
function renderLiveSignals(c) {
  const pollenType = c.grass>c.birch&&c.grass>c.weed&&c.grass>c.ragweed ? "Grass"
    : c.ragweed>c.birch&&c.ragweed>c.weed ? "Ragweed"
    : c.birch>c.weed ? "Tree (birch)" : "Weed";
  const cards = [
    { cls:"weather", label:"Weather", value:`${c.currentTemp}°F`, sum:`${WCODE[c.wcode]||"Variable"} · ${c.humidity}% humidity · wind ${c.wind} mph`, mode:"live" },
    { cls:"noaa", label:"NOAA / NWS", value:c.noaaAlerts.length?`${c.noaaAlerts.length} alert${c.noaaAlerts.length>1?"s":""}`:"Clear", sum:c.noaaAlerts.length?c.noaaAlerts.map(a=>a.event).join(", "):"No active watches or warnings for this point.", mode:"live" },
    { cls:"frost", label:"Frost", value:c.freeze?"Freeze":c.frost?"Watch":"Low", sum:`Next-3-day low ${c.minNext3}°F. ${c.freeze?"Protect tender plants tonight.":c.frost?"Near-freezing — watch seedlings.":"No near-term frost risk."}`, mode:"live" },
    { cls:"pollen", label:"Pollen", value:pollenLabel(c.maxPollen), sum:`${pollenType} dominant. Grains/m³ ≈ ${Math.round(c.maxPollen)}.`, mode:"live" },
    { cls:"rain", label:"Rain / Watering", value:`${c.rain7.toFixed(2)} in`, sum:`7-day total. ${c.noRain?"Dry stretch — soil moisture dropping.":"Some rain logged — check before watering."}`, mode:"live" },
    { cls:"soil", label:"Soil / Zone", value:state.profile.soil&&state.profile.soil!=="unknown"?state.profile.soil:"Add in passport", sum:state.profile.soil&&state.profile.soil!=="unknown"?`From your passport. ${c.city} region.`:`Set your soil type in the Garden Passport for soil-aware advice.`, mode:state.profile.soil&&state.profile.soil!=="unknown"?"live":"fallback" },
  ];
  const stack = $("#signalStack");
  if (stack) stack.innerHTML = cards.map(card =>
    `<article class="signal-pill ${card.cls} live-pulse">
      <header><h3>${esc(card.label)}</h3></header>
      <div class="value">${esc(card.value)}</div>
      <p>${esc(card.sum)}</p>
      <footer><span>${card.mode==="live"?'<span class="live-badge">live</span>':"passport"}</span><span>${card.mode==="live"?"high":"—"}</span></footer>
    </article>`
  ).join("");
  if ($("#checkedAt")) $("#checkedAt").textContent = `Checked ${new Date().toLocaleTimeString()} · live`;

  // Headline readout
  let title = "Conditions look calm — ask JarDIYn what to do", reason = `${c.city}: ${c.currentTemp}°F, ${WCODE[c.wcode]||"variable"}. No critical alerts.`;
  if (c.freeze)   { title=`Freeze risk tonight — ${c.minNext3}°F`; reason="Protect tender plants and containers before sunset."; }
  else if (c.heatWave) { title=`Heat wave building — ${c.maxNext3}°F`; reason="Prioritize deep watering and shade for vulnerable plants."; }
  else if (c.stormToday) { title="Storm approaching today"; reason="Secure staked plants and containers before it hits."; }
  else if (c.noaaAlerts.length) { title=`NOAA: ${c.noaaAlerts[0].event}`; reason=c.noaaAlerts[0].headline||"Check the alert before outdoor work."; }
  if ($("#nextActionTitle")) $("#nextActionTitle").textContent = title;
  if ($("#nextActionReason")) $("#nextActionReason").textContent = reason;

  // Mirror to the Intelligence Trace drawer as verifiable entries
  addTrace({ type:"live_geocode", summary:`${c.city}, ${c.state||""} resolved (${c.lat.toFixed(3)}, ${c.lon.toFixed(3)})`, tools:["geocoding-api.open-meteo.com"] });
  addTrace({ type:"live_weather", summary:`Current ${c.currentTemp}°F, ${WCODE[c.wcode]||"variable"}, wind ${c.wind} mph · 10-day forecast retained`, tools:["api.open-meteo.com/forecast"] });
  addTrace({ type:"live_pollen", summary:`${pollenType} pollen ${pollenLabel(c.maxPollen)} (≈${Math.round(c.maxPollen)} grains/m³)`, tools:["air-quality-api.open-meteo.com"] });
  addTrace({ type:"live_noaa", summary:c.noaaAlerts.length?`${c.noaaAlerts.length} active NOAA alert(s)`:"No active NOAA alerts", tools:["api.weather.gov/alerts"] });
}

// ── ZIP entry from welcome ──────────────────────────────────────────────────
async function welcomeLoadZip() {
  const input = $("#welcomeZip");
  const btn   = $("#welcomeZipGo");
  const query = input?.value.trim();
  if (!query) { input?.focus(); return; }
  const statusEl = $("#welcomeZipStatus");
  statusEl.innerHTML = ""; statusEl.classList.add("active");
  const log = (msg, cls="") => { const d=document.createElement("div"); d.className=`wz-line ${cls}`; d.textContent=msg; statusEl.appendChild(d); statusEl.scrollTop=statusEl.scrollHeight; };
  if (btn) { btn.disabled = true; btn.textContent = "Loading…"; }

  const cond = await loadLiveConditionsTraced(query, log);
  if (btn) { btn.disabled = false; btn.textContent = "See my garden →"; }
  if (!cond) return;

  // Persist as lightweight passport
  if ($("#siteName") && !$("#siteName").value.trim()) $("#siteName").value = `${cond.city} Garden`;
  if ($("#zip")) $("#zip").value = cond.isZip ? cond.zip : cond.city;
  collectProfile();
  state.profile.hardiness_zone = state.profile.hardiness_zone || "";
  localStorage.setItem("jardiyn_live_forecast", JSON.stringify({ city:cond.city, lat:cond.lat, lon:cond.lon, forecast10:cond.forecast10, at:Date.now() }));

  // Reveal app with real signals + fire situational alerts
  log("→ Opening your garden dashboard…", "done");
  setTimeout(() => {
    hideWelcome();
    switchTab("ask");
    renderLiveSignals(cond);
    // real situational alerts from the same live data
    _shown.clear();
    const alerts = buildAlerts({ minNext3:cond.minNext3, maxNext3:cond.maxNext3, maxNext7:cond.maxNext7, freeze:cond.freeze, frost:cond.frost, heatWave:cond.heatWave, hotSpell:cond.hotSpell, stormToday:cond.stormToday, noRain:cond.noRain, rain7:cond.rain7, maxPollen:cond.maxPollen, grass:cond.grass, birch:cond.birch, weed:cond.weed }, state.profile);
    ["red","amber","green"].forEach(u=>alerts.filter(a=>a.urgency===u).forEach((a,i)=>setTimeout(()=>pushAlert(a),600+i*700)));
    // Open trace drawer briefly so the user sees the verification
    $(".app-shell")?.classList.add("trace-open");
    setTimeout(()=>$(".app-shell")?.classList.remove("trace-open"), 4200);
  }, 700);
}

// ── Explore mode ────────────────────────────────────────────────────────────
function enterExplore() {
  exploreMode = true;
  hideWelcome();
  $("#exploreBanner")?.classList.add("show");
  // neutral sample profile
  const s = { site_name:"Sample Garden", zip_code:"49503", soil:"loam", sun:"full_sun", goals:["vegetables","pollinators"] };
  if ($("#siteName")) $("#siteName").value = s.site_name;
  if ($("#zip")) $("#zip").value = s.zip_code;
  if ($("#soil")) $("#soil").value = s.soil;
  if ($("#sun")) $("#sun").value = s.sun;
  state.goals = new Set(s.goals);
  localStorage.setItem("jardiyn_goals", JSON.stringify([...state.goals]));
  $$("#goalTags button").forEach(b => b.classList.toggle("active", state.goals.has(b.dataset.goal)));
  collectProfile();
  switchTab("ask");
  refreshSignals();
  addMessage("assistant", "You're in **Explore mode** with a sample garden. Browse every tab, try the **📷 Photo** button to diagnose a sample plant, or ask anything. When you're ready for live data tuned to your yard, click **Build my passport** up top.");
}
function exitExplore() {
  exploreMode = false;
  $("#exploreBanner")?.classList.remove("show");
  $("#sidebar")?.classList.add("open");
  $("#overlay")?.classList.add("show");
  $("#siteName")?.focus();
  addMessage("assistant", "Great — let's build your passport. Fill in your ZIP, soil, sun, and goals in the panel on the left, then hit **Refresh signals** to pull live data for your exact spot.");
}

// ── Sample plants (explore mode photo) ──────────────────────────────────────
const SAMPLE_PLANTS = {
  tomato_blight:  { emoji:"🍅", name:"Tomato — early blight", symptoms:"My tomato has dark concentric-ring spots on the lower leaves with yellowing around them, slowly spreading upward. What is it and what do I do?" },
  rose_blackspot: { emoji:"🌹", name:"Rose — black spot", symptoms:"Black spots with fringed edges on my rose leaves, the leaves are yellowing and dropping. How do I treat this?" },
  squash_mildew:  { emoji:"🎃", name:"Squash — powdery mildew", symptoms:"White powdery coating spreading fast across my squash leaves in humid weather. What should I do?" },
  hosta_slug:     { emoji:"🌿", name:"Hosta — slug damage", symptoms:"Irregular holes chewed through my hosta leaves with slime trails in the morning. How do I stop it?" },
  pepper_ber:     { emoji:"🫑", name:"Pepper — blossom end rot", symptoms:"Sunken dark leathery patches on the bottom of my peppers. What causes this and how do I fix it?" },
  maple_scorch:   { emoji:"🍁", name:"Maple — leaf scorch", symptoms:"Browning crispy edges on my maple leaves during hot dry weather. Is the tree in trouble?" },
};
function openSamplePlants() {
  const grid = $("#sampleGrid"); if (!grid) return;
  grid.innerHTML = Object.entries(SAMPLE_PLANTS).map(([id,s]) =>
    `<button class="sample-card" onclick="diagnoseSample('${id}')">
      <span class="sample-card-emoji">${s.emoji}</span>
      <span class="sample-card-name">${esc(s.name)}</span>
    </button>`
  ).join("");
  $("#sampleOverlay")?.classList.add("open");
}
function closeSamplePlants() { $("#sampleOverlay")?.classList.remove("open"); }
window.diagnoseSample = function(id) {
  const s = SAMPLE_PLANTS[id]; if (!s) return;
  closeSamplePlants();
  switchTab("ask");
  setTimeout(() => sendMessage(s.symptoms), 150);
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  wire();
  restoreProfile();
  renderTrace();

  const onboarded = localStorage.getItem("jardiyn_onboarded");
  if (!onboarded) {
    // First visit — lead with the welcome screen. Don't pre-fill the chat.
    showWelcome();
  } else {
    addMessage("assistant", "Ask me what you are trying to decide. I will fold weather, NOAA/NWS, frost, pollen, rainfall, soil, zone, and garden memory into one practical recommendation.");
  }

  await loadStatus();
  await loadSources();
  await refreshSignals();
  await loadTasks();
  await loadPlants();

  // Situational awareness — runs once the user has a location, then every 30min
  setTimeout(runAwareness, 2500);
  setInterval(()=>{ _shown.clear(); runAwareness(); }, 30*60*1000);
  $("#zip")?.addEventListener("change", ()=>setTimeout(runAwareness, 800));
}

init().catch(err => {
  console.error("JarDIYn init failed:", err);
  addMessage("assistant", `Startup issue: ${esc(err.message)}`);
});
