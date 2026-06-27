import Anthropic from "@anthropic-ai/sdk";
import { JARDIYN_TOOLS } from "./tools.js";
import { dispatchTool } from "./toolHandlers.js";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const MAX_TOOL_ROUNDS = 5;
const FORCE_FALLBACK = process.env.FORCE_FALLBACK_AGENT === "true";

function requestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProfile(profile = {}) {
  const goals = Array.isArray(profile.goals) ? profile.goals : String(profile.goals || "").split(",").map(s => s.trim()).filter(Boolean);
  return {
    site_name: profile.site_name || profile.siteName || "My Garden",
    zip_code: profile.zip_code || profile.zip || "",
    hardiness_zone: profile.hardiness_zone || profile.zone || profile.usda_zone || "",
    soil_type: profile.soil_type || profile.soil || "",
    sun_exposure: profile.sun_exposure || profile.sun || "",
    goals,
    experience_level: profile.experience_level || profile.experience || "",
    budget: profile.budget || "",
    maintenance_tolerance: profile.maintenance_tolerance || profile.maintenance || "",
    water_access: profile.water_access || "",
    drainage: profile.drainage || "",
    deer_pressure: profile.deer_pressure || "",
    pest_pressure: profile.pest_pressure || "",
    known_problems: Array.isArray(profile.known_problems) ? profile.known_problems : String(profile.known_problems || "").split(",").map(s => s.trim()).filter(Boolean),
    past_failures: Array.isArray(profile.past_failures) ? profile.past_failures : String(profile.past_failures || "").split(",").map(s => s.trim()).filter(Boolean),
    latitude: profile.latitude,
    longitude: profile.longitude
  };
}

function buildSystemPrompt(gardenProfile) {
  const p = normalizeProfile(gardenProfile || {});
  return `You are JarDIYn by GardenHub, an outdoor confidence platform.

Core mission:
Turn professional garden knowledge into realistic backyard action. Help users avoid costly mistakes, recover from garden failure, and keep going.

Active Garden Passport:
- Site: ${p.site_name}
- ZIP: ${p.zip_code || "unknown"}
- Zone: ${p.hardiness_zone || "unknown"}
- Soil: ${p.soil_type || "unknown"}
- Sun: ${p.sun_exposure || "unknown"}
- Goals: ${p.goals.join(", ") || "unknown"}
- Experience: ${p.experience_level || "unknown"}
- Budget: ${p.budget || "unknown"}
- Maintenance tolerance: ${p.maintenance_tolerance || "unknown"}
- Water access: ${p.water_access || "unknown"}
- Drainage: ${p.drainage || "unknown"}
- Deer/pest pressure: ${p.deer_pressure || p.pest_pressure || "unknown"}
- Known problems: ${p.known_problems.join(", ") || "none listed"}
- Past failures: ${p.past_failures.join(", ") || "none listed"}

Tool rules:
- You decide whether tools are needed.
- Call tools when they improve the answer with profile, zone, soil, weather, plant, diagnosis, plan-check, or garden-plan context.
- Do not call tools just to look technical.
- If the user asks for a Plan Check, use plan_check.
- If the user asks for a complete plan/report/shopping list, use generate_garden_plan.
- If the user asks about future GIS, satellite, drone, property OSINT, or municipal layers, use property_gis_preview and clearly label it roadmap-only.

Trust and safety:
- Never expose private coordinates, EXIF, secrets, or raw internal logs.
- Never guarantee plant survival.
- Do not claim GIS, drone, accounts, marketplace, or professional review features are live unless the tool output says they are live.
- Do not replace surveys, permits, engineering, arborist review, pesticide labels, medical/poison control, or licensed professional judgment.
- Be direct but supportive: correct the plan, not the person.

Response style:
- Lead with the practical answer.
- Use clear headings.
- Include “What may fail” when useful.
- Include next actions.
- Mention sources/context used when specific recommendations depend on tools or user profile.`;
}

function sanitizeTraceBlock(block) {
  if (block.type === "text") return { type: "text", textPreview: String(block.text || "").slice(0, 180) };
  if (block.type === "tool_use") return { type: "tool_use", name: block.name, inputKeys: Object.keys(block.input || {}) };
  return { type: block.type || "unknown" };
}

function extractSourcesFromTools(toolResults = []) {
  const sources = new Set(["Garden Passport"]);
  for (const tr of toolResults) {
    if (tr?.provenance?.source) sources.add(tr.provenance.source);
    if (Array.isArray(tr?.sources_used)) tr.sources_used.forEach(s => sources.add(s));
  }
  return [...sources];
}

function estimateConfidence(toolResults = [], fallbackMode = false) {
  if (fallbackMode) return "medium — transparent fallback mode";
  if (!toolResults.length) return "medium — profile/general guidance";
  if (toolResults.some(t => t?.provenance?.status === "live")) return "medium-high — live public data plus profile";
  return "medium — curated fallback/profile context";
}

export async function runGardenAgent(userMessage, gardenProfile = null, conversationHistory = [], options = {}) {
  const id = options.requestId || requestId();
  const started = Date.now();
  const profile = normalizeProfile(gardenProfile || {});
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const toolResults = [];
  const trace = [];
  const toolsUsed = [];

  if (!hasKey || FORCE_FALLBACK) {
    const fallback = await runFallbackAgent(userMessage, profile, id);
    return {
      ...fallback,
      requestId: id,
      mode: hasKey ? "fallback-forced" : "fallback-no-llm-key",
      model: hasKey ? "fallback" : "none",
      latencyMs: Date.now() - started
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages = [
      ...sanitizeConversationHistory(conversationHistory),
      { role: "user", content: typeof userMessage === "string" ? userMessage : JSON.stringify(userMessage) }
    ];

    for (let round = 1; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 2200,
        system: buildSystemPrompt(profile),
        tools: JARDIYN_TOOLS,
        messages
      });

      trace.push({
        round,
        stopReason: response.stop_reason,
        blocks: response.content.map(sanitizeTraceBlock)
      });

      if (response.stop_reason === "end_turn") {
        const answer = response.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
        return buildAgentResult({
          id,
          answer: answer || "I could not produce a complete answer. Please try again.",
          toolsUsed,
          toolResults,
          trace,
          mode: "llm-agentic",
          model: DEFAULT_MODEL,
          started
        });
      }

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });
        const toolContent = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const result = await dispatchTool(block.name, enrichToolInput(block.input, profile, userMessage));
          toolsUsed.push(block.name);
          toolResults.push(result);
          toolContent.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        }
        messages.push({ role: "user", content: toolContent });
        continue;
      }

      const partial = response.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      return buildAgentResult({
        id,
        answer: partial || "The model stopped before completing the answer. Please try again.",
        toolsUsed,
        toolResults,
        trace,
        mode: "llm-partial",
        model: DEFAULT_MODEL,
        started,
        warning: response.stop_reason
      });
    }

    return buildAgentResult({
      id,
      answer: "I reached the tool-call limit. Please ask a narrower question or choose Plan Check / Garden Plan.",
      toolsUsed,
      toolResults,
      trace,
      mode: "llm-max-rounds",
      model: DEFAULT_MODEL,
      started,
      warning: "max_tool_rounds"
    });
  } catch (error) {
    const fallback = await runFallbackAgent(userMessage, profile, id);
    return {
      ...fallback,
      mode: "fallback-after-llm-error",
      model: DEFAULT_MODEL,
      warning: "LLM call failed; used transparent fallback engine.",
      errorSafeMessage: error.message?.slice(0, 160),
      latencyMs: Date.now() - started
    };
  }
}

function sanitizeConversationHistory(history = []) {
  return history
    .filter(m => ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .slice(-8)
    .map(m => ({ role: m.role, content: m.content.slice(0, 3000) }));
}

function enrichToolInput(input = {}, profile = {}, userMessage = "") {
  return {
    ...input,
    zip_code: input.zip_code || profile.zip_code,
    latitude: input.latitude ?? profile.latitude,
    longitude: input.longitude ?? profile.longitude,
    hardiness_zone: input.hardiness_zone || profile.hardiness_zone,
    soil_type: input.soil_type || profile.soil_type,
    user_soil: input.user_soil || profile.soil_type,
    sun_exposure: input.sun_exposure || profile.sun_exposure,
    drainage: input.drainage || profile.drainage,
    maintenance_tolerance: input.maintenance_tolerance || profile.maintenance_tolerance,
    goals: input.goals || profile.goals,
    garden_profile: input.garden_profile || profile,
    plan_text: input.plan_text || (typeof userMessage === "string" ? userMessage : ""),
    symptom_description: input.symptom_description || (typeof userMessage === "string" ? userMessage : "")
  };
}

function buildAgentResult({ id, answer, toolsUsed, toolResults, trace, mode, model, started, warning }) {
  const sourcesUsed = extractSourcesFromTools(toolResults);
  return {
    requestId: id,
    answer,
    response: answer,
    toolsUsed: [...new Set(toolsUsed)],
    sourcesUsed,
    confidence: estimateConfidence(toolResults, mode?.startsWith("fallback")),
    trace,
    toolResults: toolResults.map(t => ({
      tool: t.tool,
      label: t.label,
      user_safe_summary: t.user_safe_summary,
      provenance: t.provenance,
      duration_ms: t.duration_ms
    })),
    profileReceived: true,
    mode,
    model,
    latencyMs: Date.now() - started,
    timestamp: new Date().toISOString(),
    warning
  };
}

async function runFallbackAgent(userMessage, profile, id) {
  const started = Date.now();
  const text = typeof userMessage === "string" ? userMessage : JSON.stringify(userMessage);
  const lower = text.toLowerCase();
  const tools = [];
  const results = [];

  async function useTool(name, input = {}) {
    const result = await dispatchTool(name, enrichToolInput(input, profile, text));
    tools.push(name);
    results.push(result);
    return result;
  }

  if (/gis|parcel|satellite|drone|osint|property passport|municipal/.test(lower)) {
    await useTool("property_gis_preview");
  } else if (/garden plan|generate.*plan|shopping list|full report|complete plan|monthly report/.test(lower)) {
    await useTool("generate_garden_plan", { garden_profile: profile, plan_goal: text });
  } else if (/plan check|what will fail|risky|avoid buying|is my plan|check my plan/.test(lower)) {
    await useTool("plan_check", { plan_text: text, garden_profile: profile });
  } else {
    if (/water|watering|rain|weather|heat|frost|freeze/.test(lower)) await useTool("get_weather_context");
    if (/soil|clay|sand|drain|compost|amend/.test(lower)) await useTool("get_soil_profile");
    if (/zone|frost|plant now|when to plant/.test(lower) || !profile.hardiness_zone) await useTool("get_garden_zone");
    if (/plant|recommend|nursery|pollinator|native|vegetable|shade|sun|flower|herb/.test(lower)) await useTool("lookup_plant_database");
    if (/yellow|spot|bug|pest|disease|wilt|dying|dead|diagnose|problem/.test(lower)) await useTool("diagnose_plant_issue");
    if (!results.length) await useTool("plan_check", { plan_text: text, garden_profile: profile });
  }

  const answer = composeFallbackAnswer(text, profile, results);
  return buildAgentResult({
    id,
    answer,
    toolsUsed: tools,
    toolResults: results,
    trace: [{ round: 1, stopReason: "transparent_fallback", blocks: tools.map(name => ({ type: "tool_use", name })) }],
    mode: "fallback-transparent",
    model: "fallback",
    started
  });
}

function composeFallbackAnswer(userMessage, profile, results) {
  const byTool = Object.fromEntries(results.map(r => [r.tool, r]));
  const lines = [];
  lines.push(`## Practical answer`);
  lines.push(`I used your Garden Passport context${profile.zip_code ? ` for ZIP ${profile.zip_code}` : ""} and checked the most relevant JarDIYn tools for this request.`);

  if (byTool.plan_check) {
    const r = byTool.plan_check;
    lines.push(`\n## What looks good`);
    r.what_looks_good.forEach(x => lines.push(`- ${x}`));
    lines.push(`\n## What may fail`);
    r.what_may_fail.forEach(x => lines.push(`- ${x}`));
    lines.push(`\n## What I would change`);
    r.what_i_would_change.forEach(x => lines.push(`- ${x}`));
    lines.push(`\n## Next 3 actions`);
    r.next_3_actions.forEach(x => lines.push(`- ${x}`));
  }

  if (byTool.generate_garden_plan) {
    const p = byTool.generate_garden_plan;
    lines.push(`\n## Site Summary`);
    lines.push(`- Site: ${p.site_summary.name}`);
    lines.push(`- Zone: ${p.site_summary.zone}`);
    lines.push(`- Soil: ${p.site_summary.soil}`);
    lines.push(`- Sun: ${p.site_summary.sun}`);
    lines.push(`\n## Recommended Plants`);
    p.recommended_plants.forEach(x => lines.push(`- **${x.common_name}** (${x.latin_name}) — ${x.notes}`));
    lines.push(`\n## Avoid List`);
    p.avoid_list.forEach(x => lines.push(`- ${x}`));
    lines.push(`\n## Weekend Tasks`);
    p.weekend_tasks.forEach(x => lines.push(`- ${x}`));
    lines.push(`\n## Shopping List`);
    p.shopping_list.forEach(x => lines.push(`- ${x}`));
    lines.push(`\n## When to Call a Professional`);
    p.when_to_call_a_professional.forEach(x => lines.push(`- ${x}`));
  }

  if (byTool.lookup_plant_database && !byTool.generate_garden_plan && !byTool.plan_check) {
    lines.push(`\n## Plant matches`);
    byTool.lookup_plant_database.matching_plants.slice(0, 6).forEach(x => lines.push(`- **${x.common_name}** (${x.latin_name}) — ${x.notes}`));
    lines.push(`\n## Avoid before buying`);
    byTool.lookup_plant_database.avoid_notes.forEach(x => lines.push(`- ${x}`));
  }

  if (byTool.get_soil_profile) {
    lines.push(`\n## Soil notes`);
    lines.push(`- ${byTool.get_soil_profile.user_safe_summary}`);
    byTool.get_soil_profile.amendment_suggestions?.slice(0, 3).forEach(x => lines.push(`- ${x}`));
  }

  if (byTool.get_weather_context) {
    lines.push(`\n## Weather / watering`);
    lines.push(`- ${byTool.get_weather_context.user_safe_summary}`);
    lines.push(`- Watering guidance: ${byTool.get_weather_context.watering_recommendation}`);
  }

  if (byTool.diagnose_plant_issue) {
    lines.push(`\n## Plant problem triage`);
    byTool.diagnose_plant_issue.likely_causes.forEach(x => lines.push(`- ${x.cause} (${x.confidence}): ${x.first_check}`));
    lines.push(`\n## Safe next steps`);
    byTool.diagnose_plant_issue.safe_next_steps.forEach(x => lines.push(`- ${x}`));
  }

  if (byTool.property_gis_preview) {
    lines.push(`\n## Property Intelligence Roadmap`);
    lines.push(byTool.property_gis_preview.summary);
    lines.push(`\n## Guardrail`);
    lines.push(byTool.property_gis_preview.guardrail);
  }

  lines.push(`\n## Confidence`);
  lines.push(`Medium. This is useful planning guidance, not a survey, permit review, pesticide instruction, edible plant verification, or professional tree-risk assessment.`);
  return lines.join("\n");
}
