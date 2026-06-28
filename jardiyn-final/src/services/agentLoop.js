import { getTools, toAnthropicTool } from "./tools.js";
import { executeTool, normalizeGardenProfile } from "./toolHandlers.js";
import { logAgentRun, addMemory, addTask } from "./store.js";

export function isFallbackMode() {
  if (process.env.FORCE_FALLBACK_AGENT === "1" || process.env.FORCE_FALLBACK_AGENT === "true") return true;
  if (process.env.FORCE_FALLBACK_AGENT === "false" && process.env.ANTHROPIC_API_KEY) return false;
  return !process.env.ANTHROPIC_API_KEY;
}

function has(msg, words) {
  const m = String(msg || "").toLowerCase();
  return words.some(w => m.includes(w));
}

export function planTools(message = "", profile = {}) {
  const tools = new Set();
  const msg = String(message || "").toLowerCase();
  if (has(msg, ["what should i do","this week","today","garden","yard","plan","report","weekend","plant","water","soil","weather"])) tools.add("get_garden_zone");
  if (has(msg, ["weather","today","this week","wind","rain","hot","cold","forecast"])) tools.add("get_weather_forecast");
  if (has(msg, ["noaa","alert","warning","watch","advisory","storm","freeze","severe"])) tools.add("get_noaa_alerts");
  if (has(msg, ["frost","freeze","cold","cover","protect","seedling","tender"])) tools.add("get_frost_alerts");
  if (has(msg, ["pollen","allergy","pollinator","bloom","ragweed"])) tools.add("get_pollen_forecast");
  if (has(msg, ["water","watering","rain","rainfall","dry","drought","irrigat"])) tools.add("get_recent_rainfall");
  if (has(msg, ["soil","clay","sand","loam","drain","compost","ph","amend"]) || profile.soil) tools.add("get_soil_profile");
  if (has(msg, ["recommend","lookup","perennial","annual","native","vegetable","flower","herb","tomato"])) tools.add("lookup_plant_database");
  if (has(msg, ["diagnose","yellow","spots","bugs","aphid","disease","mildew","dying","wilting","photo"])) tools.add("diagnose_plant_issue");
  if (has(msg, ["plan","design","bed","season","month","garden plan","what should i plant"])) tools.add("generate_garden_plan");
  if (has(msg, ["report","monthly","weekly","summary","priorities"])) tools.add("generate_diy_report");
  if (has(msg, ["gis","property","slope","map","site","spatial"])) tools.add("property_gis_preview");
  if (tools.size === 0) ["get_garden_zone","get_weather_forecast","get_soil_profile"].forEach(t => tools.add(t));
  if (has(msg, ["what should i do","this week","today"]))
    ["get_weather_forecast","get_noaa_alerts","get_frost_alerts","get_pollen_forecast","get_recent_rainfall"].forEach(t => tools.add(t));
  return [...tools].slice(0, 8);
}

function toolInput(tool, message, profile) {
  if (tool === "lookup_plant_database") {
    const m = String(message).toLowerCase();
    const plant = ["tomato","lavender","hydrangea","coneflower","pepper","basil","hosta","rose"].find(p => m.includes(p)) || "low maintenance plants";
    return { ...profile, query: plant };
  }
  if (tool === "diagnose_plant_issue") return { ...profile, symptoms: message };
  if (tool === "generate_garden_plan")  return { profile, horizon: has(message,["weekend"]) ? "weekend" : has(message,["season"]) ? "season" : "week" };
  if (tool === "generate_diy_report")   return { profile, timeframe: has(message,["month"]) ? "month" : "week" };
  return { ...profile, message };
}

function collectSources(results) {
  const seen = new Set();
  return results.map(t => ({ tool:t.tool, provider:t.provider||t.source, mode:t.mode, confidence:t.confidence, checked_at:t.checked_at, summary:t.summary }))
    .filter(s => { const k=`${s.tool}:${s.provider}`; if(seen.has(k)) return false; seen.add(k); return true; });
}

function label(name) { return name.replace(/^get_/,"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }

function deriveSuggestedTasks(results) {
  const tasks = [];
  for (const r of results) {
    if (r.tool==="get_frost_alerts" && r.data?.level!=="low") tasks.push({ title:"Prepare frost protection", priority:"high", due:"before next cold night" });
    if (r.tool==="get_recent_rainfall") tasks.push({ title:"Check soil moisture before watering", priority:"medium", due:"today" });
    if (r.tool==="get_soil_profile") tasks.push({ title:"Add compost or mulch where soil is bare", priority:"medium", due:"this week" });
  }
  return tasks.slice(0,5);
}

function synthesize(message, profile, results) {
  const checked = results.map(t => `- ${label(t.tool)}: ${t.summary}`).join("\n");
  const next = []; for (const r of results) for (const a of r.next_actions||[]) if (!next.includes(a)) next.push(a);
  const noaa=results.find(t=>t.tool==="get_noaa_alerts"), frost=results.find(t=>t.tool==="get_frost_alerts"),
        rain=results.find(t=>t.tool==="get_recent_rainfall"), pollen=results.find(t=>t.tool==="get_pollen_forecast"),
        soil=results.find(t=>t.tool==="get_soil_profile");
  const risks=[
    noaa?.data?.count ? "NOAA/NWS has active alerts — check before outdoor work." : null,
    frost?.data?.level && frost.data.level!=="low" ? "Frost protection needed for tender plants." : null,
    rain?.data?.guidance||null,
    pollen?.data?.level==="High" ? "High pollen — plan outdoor work timing." : null,
    soil?.data?.drainage==="slow" ? "Avoid working wet soil to prevent compaction." : null,
  ].filter(Boolean);
  return `### Read on your garden\nJarDIYn checked what matters before advising: zone, weather, NOAA/NWS, frost, pollen, rainfall, and soil for **${profile.site_name||"your garden"}**.\n\n### What JarDIYn checked\n${checked}\n\n### Recommendation\nFocus on condition-led work. Use the next calm, dry weather window for planting, cleanup, or inspection. Adjust watering from recent rainfall. Do not push into frost-risk, saturated, windy, or high-stress conditions.\n\n### Next actions\n${next.slice(0,4).length ? next.slice(0,4).map((a,i)=>`${i+1}. ${a}`).join("\n") : "1. Confirm soil moisture.\n2. Check the forecast window.\n3. Match plants to sun, soil, and maintenance level."}\n\n### Watch / do not do yet\n${risks.length ? risks.map(a=>`- ${a}`).join("\n") : "- Do not fertilize stressed plants until water and pest pressure are understood.\n- Do not spray during wind, heat, or active pollinator bloom."}\n\n### Confidence\n${results.some(t=>t.mode==="live") ? "High where live sources responded; medium where JarDIYn used fallback adapters." : "Medium: fallback intelligence active. Set LIVE_APIS=true for live weather, NOAA, pollen, and rainfall."}`;
}

async function runFallback({ message, profile, session_id, save_suggestions }) {
  const planned = planTools(message, profile);
  const trace = [{ type:"plan", mode:"fallback", tools:planned }];
  const results = [];
  for (const tool of planned) {
    const result = await executeTool(tool, toolInput(tool, message, profile), { profile, session_id });
    results.push(result);
    trace.push({ type:"tool", tool, mode:result.mode, summary:result.summary, confidence:result.confidence });
  }
  const answer = synthesize(message, profile, results);
  const suggested_tasks = deriveSuggestedTasks(results);
  if (save_suggestions && session_id) {
    addMemory(session_id, { type:"agent_summary", title:"JarDIYn recommendation", body:answer.slice(0,1200), source:"agent" });
    suggested_tasks.forEach(task => addTask(session_id, { ...task, source:"agent_suggestion" }));
  }
  return { mode:"fallback-agentic", answer, tools_used:results.map(t=>t.tool), sources:collectSources(results), trace, tool_results:results, suggested_tasks };
}

async function runLive({ message, profile, session_id, save_suggestions }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model  = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  const system = `You are JarDIYn by GardenHub — a professional spatial garden intelligence platform.

ROLE: Use tools before advising whenever weather, NOAA/NWS, frost, pollen, rainfall, soil, zone, plant fit, or diagnosis may be relevant. Always call relevant tools first. The model decides which tools.

VOICE RULES:
DO: Lead with garden-specific intelligence. Be grounded, specific, direct. Personalize around zone, soil, sun, goals — not the person. Concise unless asked for detail.
DO NOT: Open with "Great news", "Happy to help", "Of course!", "Hi friend", "I'd be glad to", "As an AI", or any mascot/lifestyle-app phrasing. No apologies. No performative warmth. No emoji in headers.

RESPONSE FORMAT — always these exact headers in this order:
### Read on your garden
### What JarDIYn checked
### Recommendation
### Next actions
### Watch / do not do yet
### Confidence

Garden profile: ${JSON.stringify(profile)}`;

  let messages = [{ role:"user", content:message }];
  const trace = [], results = [];

  for (let round = 0; round < 5; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{ "content-type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01" },
      body:JSON.stringify({ model, max_tokens:2000, system, tools:getTools().map(toAnthropicTool), messages })
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const uses = (data.content||[]).filter(b=>b.type==="tool_use");
    trace.push({ type:"anthropic_round", round, stop_reason:data.stop_reason, model:data.model, message_id:data.id, usage:data.usage, tool_uses:uses.map(t=>t.name) });
    if (!uses.length) {
      const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
      const suggested_tasks = deriveSuggestedTasks(results);
      if (save_suggestions && session_id) {
        addMemory(session_id, { type:"agent_summary", title:"JarDIYn recommendation", body:text.slice(0,1200), source:"anthropic" });
        suggested_tasks.forEach(task => addTask(session_id, { ...task, source:"agent_suggestion" }));
      }
      return { mode:"anthropic-live", answer:text, tools_used:results.map(t=>t.tool), sources:collectSources(results), trace, tool_results:results, suggested_tasks };
    }
    messages.push({ role:"assistant", content:data.content });
    const toolContent = [];
    for (const use of uses) {
      const result = await executeTool(use.name, use.input||{}, { profile, session_id });
      results.push({ ...result, tool_use_id:use.id });
      toolContent.push({ type:"tool_result", tool_use_id:use.id, content:JSON.stringify(result) });
    }
    messages.push({ role:"user", content:toolContent });
  }
  return runFallback({ message, profile, session_id, save_suggestions });
}

export async function runAgent({ message="", profile={}, session_id="default", save_suggestions=false }) {
  const normalized = normalizeGardenProfile(profile);
  const started = Date.now();
  try {
    const result = isFallbackMode()
      ? await runFallback({ message, profile:normalized, session_id, save_suggestions })
      : await runLive({ message, profile:normalized, session_id, save_suggestions });
    const duration_ms = Date.now() - started;
    logAgentRun({ session_id, message:String(message).slice(0,500), mode:result.mode, tools_used:result.tools_used, duration_ms, ok:true });
    return { ...result, duration_ms };
  } catch (error) {
    const fallback = await runFallback({ message, profile:normalized, session_id, save_suggestions });
    const duration_ms = Date.now() - started;
    fallback.trace.unshift({ type:"live_error_fallback", error:error.message });
    fallback.mode = "fallback-after-live-error";
    fallback.duration_ms = duration_ms;
    logAgentRun({ session_id, message:String(message).slice(0,500), mode:fallback.mode, tools_used:fallback.tools_used, duration_ms, ok:true, live_error:error.message });
    return fallback;
  }
}
