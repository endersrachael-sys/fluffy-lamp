/**
 * JarDIYn — app.js
 * Best UX pieces from every build, unified on the ask-first backend.
 * Sources:
 *   CSS/tokens       → jardiyn-dashboard-first-enterprise-gold
 *   Signal cards     → jardiyn-ask-first-fused-enterprise-gold
 *   Sidebar chips    → jardiyn-fable5-mythos-enterprise-plus
 *   Welcome hero     → jardiyn-enterprise-shippable-gold
 *   Dev panel        → jardiyn-enterprise-shippable-gold
 *   Memory counters  → jardiyn-enterprise-gold-restored-build
 *   Scenarios        → jardiyn-enterprise-shippable-gold (expanded)
 *   Alerts           → our situational awareness engine
 *   Backend API      → jardiyn-ask-first-fused-enterprise-gold (untouched)
 */
"use strict";

const $ = (id, root=document) => typeof id==="string" && id[0]==="#"
  ? root.querySelector(id) : document.getElementById(id);
const $q = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

// ── Session ──────────────────────────────────────────────────────────────────
const sessionId = localStorage.getItem("jardiyn_session_id") ||
  `s_${Math.random().toString(36).slice(2)}_${Date.now()}`;
localStorage.setItem("jardiyn_session_id", sessionId);
window.sessionId = sessionId;

const state = {
  profile: {}, goals: new Set(JSON.parse(localStorage.getItem("jardiyn_goals")||"[]")),
  trace: [], turns: 0, pendingPhoto: null, alertsShown: new Set(),
  liveCond: null,
};

// ── Utilities ────────────────────────────────────────────────────────────────
function esc(v="") { return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function md(t="") {
  let h=esc(t);
  h=h.replace(/^### (.*)$/gm,"<h3>$1</h3>").replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>");
  h=h.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/^- (.*)$/gm,"<li>$1</li>").replace(/(<li>.*?<\/li>)/gs,"<ul>$1</ul>").replace(/\n/g,"<br>");
  return h;
}
async function api(path, opts={}) {
  const r = await fetch(path, { headers:{"Content-Type":"application/json","x-jardiyn-session":sessionId,...(opts.headers||{})}, ...opts });
  const j = await r.json().catch(()=>({}));
  if (!r.ok || j.ok===false) throw new Error(j.error?.message||`Request failed: ${r.status}`);
  return j.data ?? j;
}

// ── Profile ──────────────────────────────────────────────────────────────────
function collectProfile() {
  state.profile = {
    session_id: sessionId,
    site_name:      $("siteName")?.value.trim()||"My Garden",
    zip_code:       $("zip")?.value.trim(),
    soil:           $("soil")?.value,
    sun:            $("sun")?.value,
    goals:          [...state.goals],
    experience:     $("experience")?.value,
    budget:         $("budget")?.value,
    maintenance:    $("maintenance")?.value,
    water_access:   $("waterAccess")?.value,
    drainage:       $("drainage")?.value,
    known_problems: $("knownProblems")?.value,
    past_failures:  $("pastFailures")?.value,
  };
  renderActiveProfile();
  return state.profile;
}
function renderActiveProfile() {
  const p=state.profile, el=$("activeProfile"); if(!el) return;
  el.innerHTML=`<strong>${esc(p.site_name||"My Garden")}</strong><br>ZIP ${esc(p.zip_code||"—")} · ${esc(p.soil||"soil unknown")} · ${esc((p.sun||"").replace("_"," "))}<br>${esc((p.goals||[]).join(", ")||"No goals selected")}`;
}
function restoreProfile() {
  const saved=JSON.parse(localStorage.getItem("jardiyn_profile")||"{}");
  ["siteName","zip","soil","sun","experience","budget","maintenance","waterAccess","drainage","knownProblems","pastFailures"].forEach(id=>{
    const k={siteName:"site_name",zip:"zip_code",waterAccess:"water_access",knownProblems:"known_problems",pastFailures:"past_failures"}[id]||id;
    const v=saved[k]; if(v&&$(id)) $(id).value=v;
  });
  if(saved.goals) state.goals=new Set(saved.goals);
  $$("#goalTags button").forEach(b=>b.classList.toggle("active",state.goals.has(b.dataset.goal)));
  collectProfile();
}

// ── Status ───────────────────────────────────────────────────────────────────
function setStatus(key, cls) {
  const el=$q(`[data-status="${key}"]`); if(!el) return;
  el.classList.remove("ok","warn","err","checking"); el.classList.add(cls);
}
function devLog(msg, type="info") {
  const log=$("devLog"); if(!log) return;
  const ts=new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const d=document.createElement("div"); d.className=`dev-log-line ${type}`;
  d.innerHTML=`<span class="ts">${ts}</span>${esc(msg)}`;
  log.prepend(d); [...log.children].slice(30).forEach(c=>c.remove());
}
async function loadStatus() {
  try {
    const s = await api("/api/status");
    setStatus("server","ok"); setStatus("tools","ok"); setStatus("store","ok");
    const claudeOk = s.anthropic_configured && !s.fallback_agent;
    setStatus("claude", claudeOk?"ok":"warn");
    setStatus("apis", s.live_apis?"ok":"warn");
    // Dev panel
    const dg=$("devGrid"); if(dg) {
      const cells=[
        {k:"Version",v:s.version||"—",cls:"ok"},
        {k:"Agent",v:s.fallback_agent?"Fallback":"Claude live",cls:claudeOk?"ok":"warn"},
        {k:"Model",v:s.fallback_agent?"local":"claude-sonnet-4-6",cls:"ok"},
        {k:"Live APIs",v:s.live_apis?"true":"false",cls:s.live_apis?"ok":"warn"},
        {k:"API Key",v:s.anthropic_configured?"set":"missing",cls:s.anthropic_configured?"ok":"err"},
        {k:"Session",v:sessionId.slice(0,12)+"…",cls:"ok"},
      ];
      dg.innerHTML=cells.map(c=>`<div class="dev-cell ${c.cls}"><div class="k">${esc(c.k)}</div><div class="v">${esc(c.v)}</div></div>`).join("");
    }
    addTrace({type:"status",summary:`${s.fallback_agent?"Fallback intelligence":"Claude live · claude-sonnet-4-6"} · APIs ${s.live_apis?"live":"fallback"} · v${s.version||"—"}`});
    devLog(`Status OK — agent: ${s.fallback_agent?"fallback":"live"}, APIs: ${s.live_apis?"live":"off"}`, "api");
  } catch(e) {
    ["server","claude","apis","tools","store"].forEach(k=>setStatus(k,"err"));
    devLog(`Status check failed: ${e.message}`, "err");
  }
}

// ── Signal stack ─────────────────────────────────────────────────────────────
const SMETA={weather:{label:"Weather",cls:"weather"},noaa:{label:"NOAA / NWS",cls:"noaa"},frost:{label:"Frost",cls:"frost"},pollen:{label:"Pollen",cls:"pollen"},rain:{label:"Rain / Watering",cls:"rain"},soil:{label:"Soil / Zone",cls:"soil"}};
function metricFor(id, w, sec) {
  const d=w?.data||{};
  if(id==="weather") return d.temperature_f?`${Math.round(d.temperature_f)}°F`:d.summary||"Forecast";
  if(id==="noaa")    return d.active_alerts?.length?`${d.active_alerts.length} alert${d.active_alerts.length>1?"s":""}`:"Clear";
  if(id==="frost")   return d.level?`${d.level} risk`:"Low risk";
  if(id==="pollen")  return d.level||"Moderate";
  if(id==="rain")    return typeof d.total_inches==="number"?`${d.total_inches.toFixed(2)} in`:"Rainfall";
  if(id==="soil")    return `${d.texture||"Soil"} · ${sec?.data?.zone||"Zone"}`;
  return w?.summary||"Ready";
}
function renderSignalStack(data) {
  const cats=data.categories||[], stack=$("signalStack"); if(!stack) return;
  stack.innerHTML=cats.map(cat=>{
    const meta=SMETA[cat.id]||{label:cat.label,cls:cat.id}, w=cat.widget||{};
    return `<article class="signal-pill ${esc(meta.cls)}">
      <header><h3>${esc(meta.label)}</h3></header>
      <div class="value">${esc(metricFor(cat.id,w,cat.secondary))}</div>
      <p>${esc(w.summary||"Checked behind the answer.")}</p>
      <footer>
        <span>${esc(String(w.mode||"fallback").replaceAll("_"," "))}</span>
        <span>${esc(w.confidence||"medium")}</span>
      </footer>
    </article>`;
  }).join("");
  // Update intel strip in welcome hero
  cats.forEach(cat=>{
    const w=cat.widget||{};
    const val=metricFor(cat.id,w,cat.secondary);
    const vi=$(`iw-${cat.id}`), di=$(`id-${cat.id}`), mi=$(`im-${cat.id}`);
    if(vi) vi.textContent=val;
    if(di) di.textContent=w.summary||"Checked.";
    if(mi) mi.textContent=w.mode||"fallback";
  });
  if($("checkedAt")) $("checkedAt").textContent=data.checked_at?`Checked ${new Date(data.checked_at).toLocaleTimeString()}`:"Checked now";
  const first=(data.priorities||[])[0];
  if(first && !document.querySelector(".msg")) {
    // Update welcome hero readout if no messages yet
  }
  if($("doList"))    $("doList").innerHTML=(data.do_now||[]).map(x=>`<li>${esc(x)}</li>`).join("");
  if($("watchList")) $("watchList").innerHTML=(data.priorities||[]).map(x=>`<li>${esc(x.reason||x)}</li>`).join("");
  if($("avoidList")) $("avoidList").innerHTML=(data.avoid||[]).map(x=>`<li>${esc(x)}</li>`).join("");
  addTrace({type:"signal_stack",summary:"Weather, NOAA/NWS, Frost, Pollen, Rain/Watering, Soil/Zone checked.",tools:cats.map(c=>c.tool).filter(Boolean)});
}
async function refreshSignals() {
  collectProfile();
  const stack=$("signalStack"); if(stack) stack.innerHTML=`<article class="signal-pill"><header><h3>Checking signals…</h3></header><p>Weather, NOAA/NWS, frost, pollen, rain, and soil being aligned.</p></article>`;
  try {
    const data=await api("/api/dashboard",{method:"POST",body:JSON.stringify({profile:state.profile})});
    renderSignalStack(data);
    // Fire situational alerts from real dashboard data
    if(data.categories) buildAndFireAlerts(data.categories);
  } catch(e) { devLog(`Signal refresh failed: ${e.message}`,"err"); }
}

// ── Trace ────────────────────────────────────────────────────────────────────
function addTrace(entry) {
  state.trace.unshift({time:new Date().toLocaleTimeString(),...entry});
  state.trace=state.trace.slice(0,80);
  renderTrace();
}
function renderTrace() {
  const log=$("traceLog"); if(!log) return;
  log.innerHTML=state.trace.length
    ? state.trace.map(e=>`<div class="trace-entry"><strong>${esc(e.type||"event")}</strong><small>${esc(e.time)}</small><br>${esc(e.summary||e.reason||"")}${e.tools?`<br><span>${esc(e.tools.join(", "))}</span>`:""}</div>`).join("")
    : "No trace yet. Ask a question to see the reasoning path.";
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  $$(".tabs button").forEach(b=>{ b.classList.toggle("active",b.dataset.tab===tab); b.setAttribute("aria-selected",b.dataset.tab===tab); });
  $$(".tab-panel").forEach(p=>p.classList.toggle("active",p.id===tab));
  if(tab==="tasks")   loadTasks();
  if(tab==="plants")  loadPlants();
  if(tab==="sources") loadSources();
}

// ── Messages ──────────────────────────────────────────────────────────────────
function addMessage(role, text, meta={}) {
  // Remove welcome hero on first message
  const hero=$("welcomeHero"); if(hero && role==="user") hero.remove();
  const wrap=document.createElement("div"); wrap.className=`msg ${role}`;
  const avatar=`<div class="avatar" aria-hidden="true">${role==="user"?"You":"J"}</div>`;
  const chips=meta.tools_used?.length?`<div class="trace-chips">${meta.tools_used.map(t=>`<span class="chip-tool">${esc(t)}</span>`).join("")}</div>`:"";
  const dur=meta.duration_ms?`<div style="font-size:10px;color:var(--muted);margin-top:4px">${(meta.duration_ms/1000).toFixed(1)}s · ${meta.mode||"agent"}</div>`:"";
  wrap.innerHTML=role==="user"?`<div class="bubble">${md(text)}</div>${avatar}`:`${avatar}<div class="bubble">${md(text)}${chips}${dur}</div>`;
  const msgs=$("messages"); if(msgs){ msgs.appendChild(wrap); wrap.scrollIntoView({block:"end",behavior:"smooth"}); }
  if(role!=="user") { state.turns++; updateCounters(); }
}

// ── Photo pipeline ────────────────────────────────────────────────────────────
async function normalizePhoto(file) {
  if(!file||!file.type.startsWith("image/")) throw new Error("Please select an image file.");
  const bmp=await createImageBitmap(file);
  const sc=Math.min(1,1600/Math.max(bmp.width,bmp.height));
  const w=Math.round(bmp.width*sc),h=Math.round(bmp.height*sc);
  const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h); ctx.drawImage(bmp,0,0,w,h); bmp.close?.();
  const blob=await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error("encode failed")),"image/jpeg",0.85));
  const b64=await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result.split(",")[1]); fr.onerror=rej; fr.readAsDataURL(blob); });
  return {base64:b64,media_type:"image/jpeg",width:w,height:h,bytes:blob.size,preview_url:URL.createObjectURL(blob)};
}
function handlePhoto(file) {
  if(!file) return;
  normalizePhoto(file).then(n=>{
    state.pendingPhoto=n;
    const prev=$("photoPreview"),img=$("photoPreviewImg"),lbl=$("photoPreviewLabel");
    if(prev) prev.classList.add("show");
    if(img) { img.src=n.preview_url; img.alt=`Photo ${n.width}×${n.height}`; }
    if(lbl) lbl.textContent=`${n.width}×${n.height} · ${Math.round(n.bytes/1024)}KB`;
    const inp=$("messageInput"); if(inp&&!inp.value.trim()) inp.placeholder="Describe symptoms, or click Ask JarDIYn.";
  }).catch(e=>alert(e.message));
}
window.clearPhoto = function() {
  if(state.pendingPhoto?.preview_url) URL.revokeObjectURL(state.pendingPhoto.preview_url);
  state.pendingPhoto=null;
  const prev=$("photoPreview"); if(prev) prev.classList.remove("show");
  const inp=$("messageInput"); if(inp) inp.placeholder="Should I water today, plant this weekend, protect seedlings tonight…";
};

// ── Send ──────────────────────────────────────────────────────────────────────
async function sendMessage(prompt) {
  collectProfile();
  const input=$("messageInput");
  const message=prompt||input?.value.trim();
  if(!message&&!state.pendingPhoto) return;
  if(input&&!prompt) input.value="";
  switchTab("ask");
  addMessage("user",state.pendingPhoto?`[Photo] ${message||"Diagnose this plant."}`:message);
  const pending=document.createElement("div"); pending.className="msg";
  pending.innerHTML=`<div class="avatar" aria-hidden="true">J</div><div class="bubble">Checking your site context and signal stack first…</div>`;
  $("messages")?.appendChild(pending);
  devLog(`Chat: "${String(message||"[photo]").slice(0,60)}…`,"api");
  try {
    let data;
    if(state.pendingPhoto) {
      const raw=await api("/api/identify",{method:"POST",body:JSON.stringify({symptoms:message||"Diagnose this plant issue.",image_base64:state.pendingPhoto.base64,image_media_type:state.pendingPhoto.media_type,profile:state.profile})});
      clearPhoto();
      data={answer:(raw.result?.summary||raw.result?.diagnosis||JSON.stringify(raw.result||"")),tools_used:[],mode:"identify"};
    } else {
      data=await api("/api/chat",{method:"POST",body:JSON.stringify({message,profile:state.profile,save_suggestions:true})});
    }
    pending.remove();
    addMessage("assistant",data.answer,data);
    addTrace({type:"agent",summary:data.mode||"agent run",tools:data.tools_used||[]});
    (data.trace||[]).forEach(item=>addTrace({type:item.type||"tool",summary:item.summary||item.reason||item.stop_reason,tools:item.tools||(item.tool?[item.tool]:undefined)}));
    devLog(`Agent done · tools: [${(data.tools_used||[]).join(", ")||"none"}]`,"tool");
    // Sync decision board
    if(data.do_now?.length) {
      if($("doList2")) $("doList2").innerHTML=(data.do_now||[]).map(x=>`<li>${esc(x)}</li>`).join("");
      if($("watchList2")) $("watchList2").innerHTML=(data.priorities||[]).map(x=>`<li>${esc(x.reason||x)}</li>`).join("");
      if($("avoidList2")) $("avoidList2").innerHTML=(data.avoid||[]).map(x=>`<li>${esc(x)}</li>`).join("");
    }
    await loadTasks(); await updateCounters();
  } catch(e) {
    pending.remove();
    addMessage("assistant",`JarDIYn could not complete that check: ${esc(e.message)}`);
    devLog(`Error: ${e.message}`,"err");
  }
}
function fireChip(prompt) { switchTab("ask"); sendMessage(prompt); }
window.fireChip = fireChip;

// ── Tasks / Plants / Sources ──────────────────────────────────────────────────
async function loadTasks() {
  try {
    const data=await api(`/api/tasks?session_id=${encodeURIComponent(sessionId)}`);
    const tasks=data.tasks||[], list=$("tasksList");
    if(list) list.innerHTML=tasks.length?tasks.map(t=>`<article class="item-card"><h4>${esc(t.title)}</h4><p>${esc(t.priority)} · ${esc(t.due||"this week")} · ${esc(t.status||"open")}</p>${t.status!=="done"?`<button class="tag-complete" onclick="completeTask('${esc(t.id)}')">Mark done</button>`:""}</article>`).join(""):`<div class="item-card"><p>No tasks yet. Ask JarDIYn for a Plan Check or Garden Plan to generate suggested tasks.</p></div>`;
    const mini=$("memoryMini"); if(mini) { const open=tasks.filter(t=>t.status!=="done").slice(0,4); mini.innerHTML=open.length?open.map(t=>`• ${esc(t.title)}`).join("<br>"):"No pending tasks."; }
    if($("cntTasks")) $("cntTasks").textContent=tasks.filter(t=>t.status!=="done").length;
    return tasks;
  } catch { return []; }
}
async function completeTask(id) {
  await api(`/api/tasks/${id}/complete`,{method:"POST"}).catch(()=>api("/api/tasks",{method:"PATCH",body:JSON.stringify({id,patch:{status:"done"}})}));
  await loadTasks();
}
window.completeTask = completeTask;

async function loadPlants() {
  try {
    const data=await api(`/api/plants?session_id=${encodeURIComponent(sessionId)}`);
    const plants=data.plants||[], list=$("plantsList");
    if(list) list.innerHTML=plants.length?plants.map(p=>`<article class="item-card"><h4>${esc(p.name)}</h4><p><em>${esc(p.botanical||"")}</em><br>${esc(p.location||"garden")} · ${esc(p.notes||"")}</p></article>`).join(""):`<div class="item-card"><p>No tracked plants yet.</p></div>`;
    if($("cntPlants")) $("cntPlants").textContent=plants.length;
    return plants;
  } catch { return []; }
}

async function loadSources() {
  try {
    const [sources,tools]=await Promise.all([api("/api/sources"),api("/api/tools")]);
    const list=$("sourcesList"); if(!list) return;
    list.innerHTML=(sources.sources||[]).map(s=>`<article class="item-card"><h4>${esc(s.category)}</h4><p><strong>${esc(s.name)}</strong><br>${esc(s.mode)} · ${esc(s.endpoint)}<br><em>${esc(s.freshness)}</em></p></article>`).join("")+Object.values(tools.categories||{}).map(c=>`<article class="item-card"><h4>${esc(c.label||"")}</h4><p>${esc(c.description||"")}<br><em>${(c.tools||[]).map(t=>esc(t.name)).join(", ")}</em></p></article>`).join("");
    // Live tool list in sidebar
    const tl=$("toolList"); if(tl) {
      const flat=Object.values(tools.categories||{}).flatMap(c=>(c.tools||[]).map(t=>({...t,category:c.label})));
      tl.innerHTML=flat.slice(0,12).map(t=>`<div>● ${esc(t.name)} <span>· ${esc(t.category)}</span></div>`).join("") || "No tools loaded.";
    }
  } catch(e) { devLog(`Sources failed: ${e.message}`,"err"); }
}

async function updateCounters() {
  if($("cntTurns")) $("cntTurns").textContent=state.turns;
  try {
    const mem=await api(`/api/memory?session_id=${encodeURIComponent(sessionId)}`);
    if($("cntMemory")) $("cntMemory").textContent=(mem.memory||[]).length;
  } catch {}
}

function planPrompt(kind) {
  return {
    check:"Run a Plan Check before I act. Fold weather, NOAA/NWS, frost, pollen, rainfall, soil, zone, goals, known problems, and past failures into one recommendation.",
    weekly:"Generate this week's Garden Plan from my site context and current conditions. Convert it into practical tasks and watch items.",
    weekend:"Build a weekend work plan. Respect weather windows, NOAA/NWS alerts, frost, pollen, rainfall, soil moisture, and maintenance level.",
  }[kind]||"";
}

// ══ SITUATIONAL AWARENESS ════════════════════════════════════════════════════
function buildAndFireAlerts(cats) {
  const w=cats.find(c=>c.id==="weather")?.widget?.data||{};
  const frost=cats.find(c=>c.id==="frost")?.widget?.data||{};
  const pollen=cats.find(c=>c.id==="pollen")?.widget?.data||{};
  const rain=cats.find(c=>c.id==="rain")?.widget?.data||{};
  const noaa=cats.find(c=>c.id==="noaa")?.widget?.data||{};
  const alerts=[];
  const minT=w.daily_lows?.[0]||w.low_f||40;
  const maxT=w.daily_highs?.[0]||w.high_f||75;
  if(minT<=28) alerts.push({urgency:"red",icon:"🧊",title:`Freeze warning — ${Math.round(minT)}°F`,desc:"Tender plants and containers at risk. Act before sunset.",prompt:`Freeze warning — ${Math.round(minT)}°F forecast. Which plants need protection tonight and what should I do right now?`});
  else if(minT<=35) alerts.push({urgency:"amber",icon:"🌡️",title:`Frost watch — lows near ${Math.round(minT)}°F`,desc:"Near-freezing forecast. Check seedlings and containers.",prompt:`Frost watch — ${Math.round(minT)}°F. Which plants are most vulnerable and what should I do today?`});
  if(maxT>=95) alerts.push({urgency:"red",icon:"🔥",title:`Heat wave — ${Math.round(maxT)}°F`,desc:"Extreme heat building. Vegetables and containers most at risk.",prompt:`Heat wave — ${Math.round(maxT)}°F. Watering schedule, shade plan, and what not to do.`});
  if(noaa?.count>0) alerts.push({urgency:"amber",icon:"⚠️",title:`NOAA alert — ${noaa.count} active`,desc:"Active weather alert for your area. Check before outdoor work.",prompt:"There is an active NOAA/NWS alert for my area. What does it mean for my garden and what should I do?"});
  if(pollen?.level==="High"||pollen?.level==="Very high") alerts.push({urgency:"amber",icon:"🌸",title:`${pollen.level} pollen today`,desc:"Pollen affects outdoor work timing and pollinator plants.",prompt:"High pollen today. What does this mean for my outdoor work and my pollinator plants?"});
  if(rain?.total_inches<0.1&&maxT>80) alerts.push({urgency:"amber",icon:"🏜️",title:"Dry stretch — watering critical",desc:"No recent rain with warm temperatures. Soil moisture dropping.",prompt:"Dry week with warm temperatures. Specific watering plan: when, how deep, and what to watch for."});
  if(!alerts.length&&minT>40&&maxT<85&&rain?.total_inches>0.5) alerts.push({urgency:"green",icon:"🌱",title:"Good planting window",desc:`Mild temps (${Math.round(minT)}–${Math.round(maxT)}°F) with recent rain. Ideal for transplanting.`,prompt:"Good planting conditions this week. What should I plant or transplant right now?"});
  alerts.forEach((a,i)=>setTimeout(()=>pushAlert(a),800+i*700));
}
function pushAlert(a) {
  if(state.alertsShown.has(a.title)) return; state.alertsShown.add(a.title);
  const stack=$("notifStack"); if(!stack) return;
  const ts=new Date().toLocaleTimeString("en",{hour:"numeric",minute:"2-digit"});
  const card=document.createElement("div"); card.className="notif";
  const cid=`n${Math.random().toString(36).slice(2)}`; card.id=cid;
  card.innerHTML=`<div class="notif-stripe ${a.urgency}"></div><div class="notif-body"><div class="notif-row"><div class="notif-icon">${a.icon}</div><div class="notif-title">${esc(a.title)}</div><button class="notif-x" onclick="dismissNotif('${cid}')">✕</button></div><div class="notif-desc">${esc(a.desc)}</div><button class="notif-ask" onclick="fireNotif(${JSON.stringify(a.prompt).replace(/'/g,"\\'")}, '${cid}')">→ Ask JarDIYn about this</button><div class="notif-time">Live signals · ${ts}</div></div>`;
  stack.appendChild(card);
  requestAnimationFrame(()=>requestAnimationFrame(()=>card.classList.add("show")));
  if(a.urgency==="green") setTimeout(()=>dismissNotif(cid),10000);
}
window.dismissNotif = id=>{ const c=document.getElementById(id); if(!c) return; c.classList.add("hide"); setTimeout(()=>c.remove(),300); };
window.fireNotif   = (prompt,id)=>{ dismissNotif(id); switchTab("ask"); setTimeout(()=>sendMessage(prompt),150); };

// ══ GARDEN PROFILES (10 scenarios, 5 prompts each) ════════════════════════
const SCENARIOS = [
  {id:"beginner",cat:"Getting started",num:"01",title:"First Garden — Beginner",desc:"Never gardened before. Worried about killing everything. Tight budget.",
   profile:{site_name:"My First Garden",zip_code:"22030",soil:"loam",sun:"full_sun",goals:["low maintenance","pollinators"],experience:"beginner",budget:"tight",known_problems:"Never gardened before. Worried I will kill everything."},
   prompts:["What is the simplest thing I can plant this season that will probably succeed?","What are the 3 most common beginner mistakes I should avoid?","Give me a 30-day beginner plan with weekend-sized tasks.","What tools do I actually need vs what stores try to sell beginners?","What plants are forgiving if I forget to water them?"]},
  {id:"clay-soil",cat:"Getting started",num:"02",title:"Clay Soil Problem Yard",desc:"Zone 6a, heavy clay, slow drainage, lavender rotted, tomatoes wilted.",
   profile:{site_name:"Clay Soil Garden",zip_code:"49503",soil:"clay loam",sun:"partial_shade",goals:["low maintenance","pollinators"],experience:"some",budget:"moderate",drainage:"slow",known_problems:"Heavy clay soil, plants failed last year, poor drainage.",past_failures:"Lavender rotted, tomatoes wilted, lost 4 perennials"},
   prompts:["What will probably fail in my clay soil?","What plants actually thrive in heavy clay?","How do I improve clay soil without overcomplicating it?","What should I avoid buying at the nursery for clay soil?","Create a realistic 30-day recovery plan for my failed yard."]},
  {id:"pollinator",cat:"Ecology",num:"03",title:"Pollinator Native Garden",desc:"Zone 7b, full sun, converting to native pollinators. Uncertain which natives work.",
   profile:{site_name:"Pollinator Garden",zip_code:"20770",soil:"loam",sun:"full_sun",goals:["pollinators","native plants"],experience:"some",budget:"moderate",known_problems:"Want to support bees and butterflies but unsure which natives to choose"},
   prompts:["Which native pollinator plants are best for my zone?","Plan a bloom-time sequence so pollinators have food spring through fall.","What should I avoid that looks pollinator-friendly but actually is not?","How do I convert part of my lawn to a pollinator strip?","What invasive species do I need to remove before planting natives?"]},
  {id:"diagnosis",cat:"Diagnosis",num:"04",title:"Plant Disease Outbreak",desc:"Zone 7b, multiple vegetables declining at once during humid summer.",
   profile:{site_name:"Vegetable Garden",zip_code:"37027",soil:"silt loam",sun:"full_sun",goals:["vegetables"],known_problems:"Tomato leaves yellowing, white spots on squash, holes in pepper leaves"},
   prompts:["My tomato leaves are yellowing from the bottom up. What is going wrong?","White powdery spots on my squash leaves — what is it and how do I treat it safely?","Something is eating holes in my pepper plants overnight. How do I figure out what?","When should I worry versus when is yellowing normal?","What is the safest first treatment to try before chemicals?"]},
  {id:"nursery",cat:"Getting started",num:"05",title:"Nursery Shopping Assistant",desc:"About to go to the nursery. Needs a smart list and what to avoid.",
   profile:{site_name:"Shopping Garden",zip_code:"02138",soil:"sandy loam",sun:"full_sun",goals:["low maintenance","native plants"],experience:"beginner",budget:"tight",known_problems:"About to go to nursery, want a shopping list and know what to avoid"},
   prompts:["Build me a smart nursery shopping list for my zone and soil.","What should I avoid buying that looks tempting but will not survive here?","How do I tell a healthy plant from a stressed one before buying?","What questions should I ask nursery staff?","Compare 3 specific plants that would actually thrive in my conditions."]},
  {id:"drought",cat:"Climate stress",num:"06",title:"Drought / Heat Stress",desc:"Zone 9b, sandy soil, 100°F+ stretch, drip irrigation, water restrictions.",
   profile:{site_name:"Desert Garden",zip_code:"85016",soil:"sandy",sun:"full_sun",goals:["low maintenance"],water_access:"drip",known_problems:"Heat wave, plants stressed, water restrictions"},
   prompts:["We are in a 100°F+ stretch. Which of my plants are most at risk?","How much water should I give and when during a heat wave?","Should I prune, mulch, or use shade cloth right now?","What plants should I replace with more heat-tolerant options?","How can I tell heat stress from underwatering versus disease?"]},
  {id:"shade",cat:"Site challenge",num:"07",title:"Shady Front Yard",desc:"Zone 8b, north-facing, near-zero direct sun, deer pressure, clay loam.",
   profile:{site_name:"Shady Front Yard",zip_code:"97214",soil:"clay loam",sun:"full_shade",goals:["low maintenance","native plants"],known_problems:"North-facing yard, almost no direct sun, deer browse everything",past_failures:"Lavender, roses, anything needing sun"},
   prompts:["What actually thrives in deep shade besides hostas?","What deer-resistant shade plants work in my zone?","How do I design a shade garden that is not just green-on-green?","What ground covers work in shade where grass will not grow?","How do I improve clay soil in shade without sun to dry it out?"]},
  {id:"raised-beds",cat:"Food",num:"08",title:"Raised Bed Food Garden",desc:"Zone 6b, four new 4×8 beds, drip irrigation, first season, maximizing yield.",
   profile:{site_name:"Raised Bed Garden",zip_code:"43215",soil:"sandy loam",sun:"full_sun",goals:["vegetables","herbs"],water_access:"drip",known_problems:"First season, compacted soil underneath"},
   prompts:["I have four new raised beds. What should I plant right now for my zone?","Should I water today or let the drip system handle it after recent rain?","My tomato leaves have curled edges. Watering problem or temperature?","Can I plant a second crop in my lettuce beds now that it is bolting?","Run a Plan Check before I buy fall transplants."]},
  {id:"deer",cat:"Site challenge",num:"09",title:"Heavy Deer Pressure",desc:"Zone 6b, 3 acres, severe browse damage, slope, no fence possible.",
   profile:{site_name:"High Deer Property",zip_code:"07930",soil:"silt loam",sun:"partial_shade",goals:["native plants","low maintenance"],known_problems:"Severe deer browse, steep slope, no fence possible",past_failures:"Hostas and daylilies eaten to ground"},
   prompts:["Deer ate everything last night again. What deer-resistant plants actually work?","When are deer most active and what conditions make it worse?","Is there a planting window this week to put in new shrubs?","My ferns are being browsed for the first time. Why now?","Run a Plan Check for a deer-resistant native planting scheme."]},
  {id:"inspired",cat:"Design",num:"10",title:"Inspired by Public Gardens",desc:"Zone 6b, came home from Chanticleer, starting from grass lawn.",
   profile:{site_name:"Inspired Garden",zip_code:"19348",soil:"silt loam",sun:"full_sun",goals:["cut flowers","pollinators","native plants"],experience:"some",budget:"generous",known_problems:"Starting from scratch, grass lawn, no existing beds"},
   prompts:["I just visited Chanticleer and want something beautiful. Where do I start?","What plants from great public gardens actually work at home scale?","Is now the right time to start building planting beds?","I want year-round interest. What is the framework?","Run a Plan Check before I hire a landscaper."]},
];

function openProfiles() {
  const list=$("scenarioCatList"); if(!list) return;
  const byCat={};
  SCENARIOS.forEach(s=>{ (byCat[s.cat]=byCat[s.cat]||[]).push(s); });
  list.innerHTML=Object.entries(byCat).map(([cat,items])=>
    `<div class="scenario-cat-label">${esc(cat)}</div>
     <div class="scenario-cards">${items.map(s=>
       `<button class="scenario-card" id="sc-${s.id}" onclick="pickScenario('${s.id}')">
          <div class="sc-num">${esc(s.num)}</div>
          <div class="sc-title">${esc(s.title)}</div>
          <div class="sc-desc">${esc(s.desc)}</div>
        </button>`).join("")}
     </div>`
  ).join("");
  const sp=$("scenarioPrompts"); if(sp) sp.classList.remove("open");
  const ov=$("profilesOverlay"); if(ov){ ov.classList.add("open"); document.body.style.overflow="hidden"; }
}
function closeProfiles() {
  $("profilesOverlay")?.classList.remove("open");
  document.body.style.overflow="";
}
window.pickScenario = function(id) {
  const s=SCENARIOS.find(x=>x.id===id); if(!s) return;
  $$(".scenario-card").forEach(c=>c.classList.remove("active"));
  document.getElementById(`sc-${id}`)?.classList.add("active");
  const lbl=$("scenarioPromptsLabel"); if(lbl) lbl.textContent=s.title;
  const list=$("scenarioPromptList");
  if(list) list.innerHTML=s.prompts.map(p=>`<button class="sp-btn" onclick="fireScenario('${id}',${JSON.stringify(p).replace(/'/g,"\\'")})">${esc(p)}</button>`).join("");
  const sp=$("scenarioPrompts"); if(sp){ sp.classList.add("open"); sp.scrollIntoView({behavior:"smooth",block:"nearest"}); }
};
window.fireScenario = function(id, prompt) {
  const s=SCENARIOS.find(x=>x.id===id); if(!s?.profile) return;
  const p=s.profile;
  if(p.site_name&&$("siteName")) $("siteName").value=p.site_name;
  if(p.zip_code&&$("zip")) $("zip").value=p.zip_code;
  if(p.soil&&$("soil")) $("soil").value=p.soil;
  if(p.sun&&$("sun")) $("sun").value=p.sun;
  if(p.known_problems&&$("knownProblems")) $("knownProblems").value=p.known_problems;
  if(p.past_failures&&$("pastFailures")) $("pastFailures").value=p.past_failures;
  if(p.goals){ state.goals=new Set(p.goals); localStorage.setItem("jardiyn_goals",JSON.stringify([...state.goals])); $$("#goalTags button").forEach(b=>b.classList.toggle("active",state.goals.has(b.dataset.goal))); }
  collectProfile();
  closeProfiles();
  switchTab("ask");
  setTimeout(()=>sendMessage(prompt),200);
};

// ══ WIRE ═════════════════════════════════════════════════════════════════════
function wire() {
  // Tabs
  $$(".tabs button").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  // Plan actions
  $$("[data-plan-action]").forEach(b=>b.addEventListener("click",()=>{ switchTab("ask"); sendMessage(planPrompt(b.dataset.planAction)); }));
  // Intent row + welcome prompts
  $$("[data-prompt]").forEach(b=>b.addEventListener("click",()=>sendMessage(b.dataset.prompt)));
  // Goal tags
  $$("#goalTags button").forEach(b=>b.addEventListener("click",()=>{
    state.goals.has(b.dataset.goal)?state.goals.delete(b.dataset.goal):state.goals.add(b.dataset.goal);
    localStorage.setItem("jardiyn_goals",JSON.stringify([...state.goals]));
    b.classList.toggle("active"); collectProfile();
  }));
  // Profile inputs
  ["siteName","zip","soil","sun","experience","budget","maintenance","waterAccess","drainage","knownProblems","pastFailures"].forEach(id=>$(id)?.addEventListener("change",()=>{ collectProfile(); localStorage.setItem("jardiyn_profile",JSON.stringify(state.profile)); }));
  // Send
  $("sendBtn")?.addEventListener("click",()=>sendMessage());
  $("messageInput")?.addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(); } });
  // Signals
  $("refreshDashboard")?.addEventListener("click",refreshSignals);
  $("zoneBtn")?.addEventListener("click",()=>{ collectProfile(); refreshSignals(); });
  // Trace
  $("traceToggle")?.addEventListener("click",()=>document.getElementById("appShell")?.classList.toggle("trace-open"));
  $("closeTrace")?.addEventListener("click",()=>document.getElementById("appShell")?.classList.remove("trace-open"));
  // Dev panel
  $("devToggle")?.addEventListener("click",()=>$("devPanel")?.classList.toggle("open"));
  // Mobile
  $("mobileMenu")?.addEventListener("click",()=>{ $("sidebar")?.classList.add("open"); $("overlay")?.classList.add("show"); });
  $("overlay")?.addEventListener("click",()=>{ $("sidebar")?.classList.remove("open"); $("overlay")?.classList.remove("show"); });
  // Profiles
  $("profilesBtn")?.addEventListener("click",openProfiles);
  $("profilesClose")?.addEventListener("click",closeProfiles);
  $("profilesOverlay")?.addEventListener("click",e=>{ if(e.target===$("profilesOverlay")) closeProfiles(); });
  // Photo
  $("photoUpload")?.addEventListener("change",e=>handlePhoto(e.target.files[0]));
  // Tasks / plants
  $("addTaskBtn")?.addEventListener("click",async()=>{ const t=prompt("Task title"); if(t){ await api("/api/tasks",{method:"POST",body:JSON.stringify({title:t,priority:"medium",due:"this week"})}); loadTasks(); } });
  $("addPlantBtn")?.addEventListener("click",async()=>{ const n=prompt("Plant name"); if(n){ await api("/api/plants",{method:"POST",body:JSON.stringify({name:n,notes:"Manually tracked"})}); loadPlants(); } });
  $("reloadSources")?.addEventListener("click",loadSources);
}

// ══ INIT ═════════════════════════════════════════════════════════════════════
async function init() {
  wire();
  restoreProfile();
  renderTrace();
  await loadStatus();
  await loadSources();
  await refreshSignals();
  await loadTasks();
  await loadPlants();
  await updateCounters();
}

init().catch(err=>{
  console.error("JarDIYn init failed:",err);
  addMessage("assistant",`Startup issue: ${esc(err.message)}`);
});
