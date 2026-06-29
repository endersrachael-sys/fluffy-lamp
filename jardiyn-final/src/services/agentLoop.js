import { getTools, toAnthropicTool } from "./tools.js";
import { executeTool, normalizeGardenProfile } from "./toolHandlers.js";
import { logAgentRun, addMemory, addTask } from "./store.js";

export function isFallbackMode() {
  if (process.env.FORCE_FALLBACK_AGENT === "1" || process.env.FORCE_FALLBACK_AGENT === "true") return true;
  if (process.env.FORCE_FALLBACK_AGENT === "false" && process.env.ANTHROPIC_API_KEY) return false;
  return !process.env.ANTHROPIC_API_KEY;
}

function textIncludes(message, words) {
  const m = String(message || "").toLowerCase();
  return words.some((word) => m.includes(word));
}

export function planTools(message = "", profile = {}) {
  const tools = new Set();
  const msg = String(message || "").toLowerCase();
  const generalGarden = textIncludes(msg, ["what should i do", "this week", "today", "garden", "yard", "plan", "report", "weekend", "plant", "water", "soil", "weather"]);
  if (generalGarden) tools.add("get_garden_zone");
  if (textIncludes(msg, ["weather", "today", "this week", "wind", "rain", "hot", "cold", "forecast", "work window"])) tools.add("get_weather_forecast");
  if (textIncludes(msg, ["noaa", "alert", "warning", "watch", "advisory", "storm", "wind", "freeze", "severe"])) tools.add("get_noaa_alerts");
  if (textIncludes(msg, ["frost", "freeze", "cold", "cover", "protect", "seedling", "tender"])) tools.add("get_frost_alerts");
  if (textIncludes(msg, ["pollen", "allergy", "pollinator", "bloom", "ragweed", "grass pollen"])) tools.add("get_pollen_forecast");
  if (textIncludes(msg, ["water", "watering", "rain", "rainfall", "dry", "drought", "irrigat", "container"])) tools.add("get_recent_rainfall");
  if (textIncludes(msg, ["soil", "clay", "sand", "loam", "drain", "compost", "ph", "amend", "mud", "wet bed"]) || profile.soil) tools.add("get_soil_profile");
  if (textIncludes(msg, ["recommend", "lookup", "perennial", "annual", "native", "vegetable", "flower", "herb", "tomato", "lavender", "hydrangea", "coneflower"])) tools.add("lookup_plant_database");
  if (textIncludes(msg, ["diagnose", "yellow", "spots", "bugs", "aphid", "disease", "mildew", "dying", "wilting", "photo", "leaves"])) tools.add("diagnose_plant_issue");
  if (textIncludes(msg, ["plan", "design", "bed", "layout", "season", "month", "garden plan", "what should i plant"])) tools.add("generate_garden_plan");
  if (textIncludes(msg, ["report", "monthly", "weekly", "summary", "priorities"])) tools.add("generate_diy_report");
  if (textIncludes(msg, ["gis", "property", "slope", "map", "site", "spatial", "layout", "downspout"])) tools.add("property_gis_preview");
  if (tools.size === 0) ["get_garden_zone", "get_weather_forecast", "get_soil_profile"].forEach((t) => tools.add(t));
  if (textIncludes(msg, ["what should i do", "this week", "today"])) ["get_weather_forecast", "get_noaa_alerts", "get_frost_alerts", "get_pollen_forecast", "get_recent_rainfall"].forEach((t) => tools.add(t));
  return Array.from(tools).slice(0, 8);
}

function plantQueryFrom(message = "") {
  const lower = String(message).toLowerCase();
  for (const candidate of ["tomato", "lavender", "hydrangea", "coneflower", "pepper", "basil", "hosta", "rose"]) if (lower.includes(candidate)) return candidate;
  return "low maintenance plants";
}

function toolInput(tool, message, profile) {
  if (tool === "lookup_plant_database") return { ...profile, query: plantQueryFrom(message) };
  if (tool === "diagnose_plant_issue") return { ...profile, symptoms: message };
  if (tool === "generate_garden_plan") return { profile, horizon: textIncludes(message, ["weekend"]) ? "weekend" : textIncludes(message, ["season"]) ? "season" : "week" };
  if (tool === "generate_diy_report") return { profile, timeframe: textIncludes(message, ["month"]) ? "month" : "week" };
  return { ...profile, message };
}

function collectSources(toolResults) {
  const seen = new Set();
  return toolResults.map((t) => ({ tool: t.tool, provider: t.provider || t.source, mode: t.mode, confidence: t.confidence, checked_at: t.checked_at, summary: t.summary })).filter((s) => {
    const key = `${s.tool}:${s.provider}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function synthesizeAnswer(message, profile, toolResults) {
  const checked = toolResults.map((t) => `- ${label(t.tool)}: ${t.summary}`).join("\n");
  const next = [];
  for (const r of toolResults) for (const action of r.next_actions || []) if (!next.includes(action)) next.push(action);
  const priorities = next.slice(0, 4);
  const noaa = toolResults.find((t) => t.tool === "get_noaa_alerts");
  const frost = toolResults.find((t) => t.tool === "get_frost_alerts");
  const rain = toolResults.find((t) => t.tool === "get_recent_rainfall");
  const pollen = toolResults.find((t) => t.tool === "get_pollen_forecast");
  const soil = toolResults.find((t) => t.tool === "get_soil_profile");
  const riskNotes = [
    noaa?.data?.count ? "NOAA/NWS has active alerts; check that before starting outdoor work." : null,
    frost?.data?.level && frost.data.level !== "low" ? "Frost protection may be needed for tender plants." : null,
    rain?.data?.guidance || null,
    pollen?.data?.level === "High" ? "High pollen: plan work timing if allergies or wind are an issue." : null,
    soil?.data?.drainage === "slow" ? "Avoid working soil while wet to prevent compaction." : null
  ].filter(Boolean);
  return `### Read on your garden\nJarDIYn checked the signals that matter before giving advice: location/zone, weather, NOAA/NWS alerts, frost, pollen, rainfall, and soil context for **${profile.site_name || "your garden"}**.\n\n### What JarDIYn checked\n${checked}\n\n### Recommendation\nFocus on condition-led work instead of random tasks. Use the next calm, dry weather window for planting, cleanup, or inspection; adjust watering from recent rainfall; and do not push new planting into saturated, windy, frost-risk, or high-stress conditions.\n\n### Next actions\n${priorities.length ? priorities.map((a, i) => `${i + 1}. ${a}`).join("\n") : "1. Confirm soil moisture.\n2. Check the forecast window.\n3. Match plants to sun, soil, and maintenance level."}\n\n### Watch / do not do yet\n${riskNotes.length ? riskNotes.map((a) => `- ${a}`).join("\n") : "- Do not fertilize stressed plants until water, drainage, and pest pressure are understood.\n- Do not spray during wind, heat, bloom-heavy pollinator activity, or active weather alerts."}\n\n### Confidence\n${toolResults.some((t) => t.mode === "live") ? "High where live sources responded; medium where JarDIYn used fallback adapters." : "Medium: local fallback intelligence is active. Turn on LIVE_APIS for live weather, pollen, rainfall, and NOAA checks."}`;
}

function label(toolName) { return toolName.replace(/^get_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

async function runFallbackAgent({ message, profile, session_id, save_suggestions }) {
  const planned = planTools(message, profile);
  const trace = [{ type: "plan", mode: "fallback", tools: planned, reason: "JarDIYn inferred required garden intelligence categories from the prompt and profile." }];
  const toolResults = [];
  for (const tool of planned) {
    const input = toolInput(tool, message, profile);
    const result = await executeTool(tool, input, { profile, session_id });
    toolResults.push(result);
    trace.push({ type: "tool", tool, mode: result.mode, duration_ms: result.duration_ms, summary: result.summary, confidence: result.confidence });
  }
  const answer = synthesizeAnswer(message, profile, toolResults);
  const suggested_tasks = deriveSuggestedTasks(toolResults);
  if (save_suggestions && session_id) {
    addMemory(session_id, { type: "agent_summary", title: "JarDIYn recommendation", body: answer.slice(0, 1200), source: "agent" });
    suggested_tasks.forEach((task) => addTask(session_id, { ...task, source: "agent_suggestion" }));
  }
  return { mode: "fallback-agentic", answer, tools_used: toolResults.map((t) => t.tool), sources: collectSources(toolResults), trace, tool_results: toolResults, suggested_tasks };
}

function deriveSuggestedTasks(results) {
  const tasks = [];
  for (const r of results) {
    if (r.tool === "get_frost_alerts" && r.data?.level !== "low") tasks.push({ title: "Prepare frost protection for tender plants", priority: "high", due: "before next cold night" });
    if (r.tool === "get_recent_rainfall") tasks.push({ title: "Check soil moisture before watering", priority: "medium", due: "today" });
    if (r.tool === "get_soil_profile") tasks.push({ title: "Add compost/mulch where soil is bare or compacted", priority: "medium", due: "this week" });
  }
  return tasks.slice(0, 5);
}

async function runAnthropicAgent({ message, profile, session_id }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
  const system = `You are JarDIYn by GardenHub, a professional spatial garden intelligence system. Use tools before advising when weather, NOAA alerts, frost, pollen, rainfall, soil, zone, plant fit, diagnosis, or planning may matter. Voice: grounded, useful, professional, warm but not chummy, no mascot behavior. Format answers with: Read on your garden, What JarDIYn checked, Recommendation, Next actions, Watch / do not do yet, Confidence.`;
  let messages = [{ role: "user", content: `Profile: ${JSON.stringify(profile)}\n\nQuestion: ${message}` }];
  const trace = [];
  const toolResults = [];
  for (let round = 0; round < 4; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1200, system, tools: getTools().map(toAnthropicTool), messages })
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const toolUses = (data.content || []).filter((b) => b.type === "tool_use");
    trace.push({ type: "anthropic_round", round, stop_reason: data.stop_reason, tool_uses: toolUses.map((t) => t.name) });
    if (!toolUses.length) {
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      return { mode: "anthropic-live", answer: text, tools_used: toolResults.map((t) => t.tool), sources: collectSources(toolResults), trace, tool_results: toolResults, suggested_tasks: deriveSuggestedTasks(toolResults) };
    }
    messages.push({ role: "assistant", content: data.content });
    const toolContent = [];
    for (const use of toolUses) {
      const result = await executeTool(use.name, use.input || {}, { profile, session_id });
      toolResults.push(result);
      toolContent.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolContent });
  }
  return runFallbackAgent({ message, profile, session_id });
}

export async function runAgent({ message = "", profile = {}, session_id = "default", save_suggestions = false }) {
  const normalized = normalizeGardenProfile(profile);
  const started = Date.now();
  try {
    const result = isFallbackMode() ? await runFallbackAgent({ message, profile: normalized, session_id, save_suggestions }) : await runAnthropicAgent({ message, profile: normalized, session_id, save_suggestions });
    const duration_ms = Date.now() - started;
    logAgentRun({ session_id, message: String(message).slice(0, 500), mode: result.mode, tools_used: result.tools_used, duration_ms, ok: true });
    return { ...result, duration_ms };
  } catch (error) {
    const fallback = await runFallbackAgent({ message, profile: normalized, session_id, save_suggestions });
    const duration_ms = Date.now() - started;
    fallback.trace.unshift({ type: "live_error_fallback", error: error.message });
    fallback.mode = "fallback-after-live-error";
    fallback.duration_ms = duration_ms;
    logAgentRun({ session_id, message: String(message).slice(0, 500), mode: fallback.mode, tools_used: fallback.tools_used, duration_ms, ok: true, live_error: error.message });
    return fallback;
  }
}
