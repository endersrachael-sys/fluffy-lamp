import { getTool, getToolNames } from "./tools.js";
import { resolveLocation, getWeather, getNoaaAlerts, getPollen, getRainfall, getSoil, getPlantSignals, isoNow } from "./liveApis.js";
import { addTask, addPlant, logToolCall } from "../../store.js";

function clean(value, max = 1000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

export function normalizeGardenProfile(profile = {}) {
  const goals = Array.isArray(profile.goals) ? profile.goals : String(profile.goals || "").split(/[;,]/).map((x) => x.trim()).filter(Boolean);
  return {
    site_name: clean(profile.site_name || profile.siteName || profile.name || "My Garden", 100),
    zip_code: clean(profile.zip_code || profile.zip || "49503", 5).match(/\d{5}/)?.[0] || "49503",
    soil: clean(profile.soil || "unknown", 80),
    sun: clean(profile.sun || "full_sun", 80),
    goals,
    experience: clean(profile.experience || "some", 40),
    budget: clean(profile.budget || "moderate", 40),
    maintenance: clean(profile.maintenance || "low", 40),
    water_access: clean(profile.water_access || profile.water || "hose", 60),
    drainage: clean(profile.drainage || "unknown", 40),
    pest_pressure: clean(profile.pest_pressure || "medium", 40),
    known_problems: clean(profile.known_problems || profile.problems || "", 800),
    past_failures: clean(profile.past_failures || "", 800)
  };
}

function withMeta(toolName, payload, extra = {}) {
  const tool = getTool(toolName);
  return {
    ok: true,
    tool: toolName,
    category: tool?.category || "unknown",
    risk: tool?.risk || "low",
    checked_at: isoNow(),
    valid_until: new Date(Date.now() + 3600000).toISOString(),
    confidence: extra.confidence || payload.confidence || (payload.mode === "live" ? "high" : "medium"),
    provider: payload.provider || tool?.live_provider || "JarDIYn",
    mode: payload.mode || "fallback",
    data: payload,
    summary: payload.summary || extra.summary || `${toolName} completed.`,
    next_actions: extra.next_actions || [],
    warnings: [payload.warning, ...(extra.warnings || [])].filter(Boolean),
    source: payload.provider || tool?.live_provider || "JarDIYn"
  };
}

export function validateToolInput(toolName, input = {}) {
  const tool = getTool(toolName);
  if (!tool) return { ok: false, code: "UNKNOWN_TOOL", message: `Unknown tool: ${toolName}` };
  const schema = tool.input_schema || {};
  const required = schema.required || [];
  for (const key of required) {
    if (input[key] === undefined || input[key] === null || input[key] === "") return { ok: false, code: "INVALID_TOOL_INPUT", message: `${toolName} requires ${key}` };
  }
  if (input.zip_code && !/^\d{5}$/.test(String(input.zip_code))) return { ok: false, code: "INVALID_ZIP", message: "ZIP code must be five digits." };
  return { ok: true };
}

export async function executeTool(toolName, input = {}, context = {}) {
  const started = Date.now();
  const profile = normalizeGardenProfile({ ...(context.profile || {}), ...(input.profile || {}), ...input });
  const args = { ...profile, ...input };
  const validation = validateToolInput(toolName, args);
  if (!validation.ok) return { ok: false, tool: toolName, error: validation, checked_at: isoNow() };
  let result;
  switch (toolName) {
    case "get_garden_zone": {
      const loc = await resolveLocation(args);
      result = withMeta(toolName, { ...loc, summary: `${loc.city}, ${loc.state} · estimated hardiness zone ${loc.zone}.` }, { next_actions: ["Confirm microclimates and wind exposure before buying marginal plants."] });
      break;
    }
    case "get_weather_forecast": {
      const weather = await getWeather(args);
      const workWindow = (weather.daily || []).find((d) => Number(d.precip_probability || 0) < 40 && Number(d.wind_mph || 0) < 18);
      result = withMeta(toolName, { ...weather, work_window: workWindow }, { next_actions: [workWindow ? `Best near-term work window: ${workWindow.date}.` : "Use short outdoor sessions and avoid heavy work during wind/rain."] });
      break;
    }
    case "get_noaa_alerts": {
      const alerts = await getNoaaAlerts(args);
      result = withMeta(toolName, alerts, { confidence: alerts.mode === "live" ? "high" : "medium", next_actions: alerts.count ? ["Review active alert details before watering, spraying, planting, or covering plants."] : ["No active alert found; continue normal seasonal monitoring."] });
      break;
    }
    case "get_frost_alerts": {
      const [weather, noaa] = await Promise.all([getWeather(args), getNoaaAlerts(args)]);
      const lows = (weather.daily || []).map((d) => Number(d.low_f)).filter(Number.isFinite);
      const min = lows.length ? Math.min(...lows) : 40;
      const freezeAlert = (noaa.alerts || []).some((a) => /frost|freeze/i.test(`${a.event} ${a.headline}`));
      const level = freezeAlert || min <= 32 ? "warning" : min <= 38 ? "watch" : "low";
      result = withMeta(toolName, { mode: weather.mode === "live" || noaa.mode === "live" ? "live" : "fallback", provider: "NOAA/NWS + Open-Meteo minimum temperature", location: weather.location, minimum_low_f: min, level, noaa_alerts: noaa.alerts || [], summary: level === "warning" ? "Freeze/frost protection is recommended for tender plants." : level === "watch" ? "Frost watch: protect seedlings, containers, and tender starts if skies clear overnight." : "Low frost risk in the near-term signal." }, { confidence: noaa.mode === "live" ? "high" : "medium", next_actions: level === "low" ? ["Keep frost cover nearby during shoulder season."] : ["Move containers inward.", "Cover tender seedlings before sunset.", "Water dry soil earlier in the day, not at night."] });
      break;
    }
    case "get_pollen_forecast": {
      const pollen = await getPollen(args);
      result = withMeta(toolName, pollen, { next_actions: [pollen.level === "High" ? "Work after rain or later in the day; rinse tools and avoid disturbing seedheads if sensitive." : "Good window for normal outdoor work; monitor wind if planting pollinator beds."] });
      break;
    }
    case "get_recent_rainfall": {
      const rain = await getRainfall(args);
      result = withMeta(toolName, rain, { next_actions: [rain.guidance] });
      break;
    }
    case "get_soil_profile": {
      const soil = await getSoil(args);
      result = withMeta(toolName, soil, { next_actions: ["Add organic matter before buying amendments.", "Confirm pH with a soil test before lime/sulfur corrections."] });
      break;
    }
    case "lookup_plant_database": {
      const plant = await getPlantSignals(args);
      result = withMeta(toolName, plant, { next_actions: ["Check mature size and spacing.", "Match water needs to the bed, not just the label."] });
      if (context.session_id && args.save !== false) addPlant(context.session_id, { name: plant.plant.name, botanical: plant.plant.botanical, notes: plant.plant.notes, source: "lookup_plant_database" });
      break;
    }
    case "diagnose_plant_issue": {
      const symptoms = clean(args.symptoms || args.message || args.photo_context || "", 1200).toLowerCase();
      const likely = /yellow|chlorosis/.test(symptoms) ? "watering/nutrient stress or early disease pressure" : /bug|aphid|mites|insect/.test(symptoms) ? "insect pressure" : /spot|mildew|fung|blight/.test(symptoms) ? "fungal leaf disease pressure" : "environmental stress";
      const actions = likely.includes("insect") ? ["Inspect undersides of leaves.", "Use a hard water spray first.", "Escalate to insecticidal soap only if pressure persists."] : likely.includes("fungal") ? ["Remove worst affected leaves.", "Avoid overhead watering.", "Improve airflow before applying any treatment."] : ["Check soil moisture 2 inches down.", "Do not fertilize a stressed plant until watering/drainage is understood.", "Document progression with a photo in 48 hours."];
      result = withMeta(toolName, { mode: "fallback", provider: "JarDIYn symptom triage + vision-ready adapter", likely_issue: likely, symptoms: clean(args.symptoms || args.message || args.photo_context || "not provided", 1200), summary: `Likely ${likely}. Start with low-risk observation and cultural correction before treatment.` }, { confidence: "medium", next_actions: actions, warnings: ["Plant diagnosis is probabilistic; confirm with local extension service for severe or spreading disease."] });
      break;
    }
    case "generate_garden_plan": {
      const [zone, soil, weather, noaa, frost, pollen, rain] = await Promise.all([
        executeTool("get_garden_zone", args, context), executeTool("get_soil_profile", args, context), executeTool("get_weather_forecast", args, context), executeTool("get_noaa_alerts", args, context), executeTool("get_frost_alerts", args, context), executeTool("get_pollen_forecast", args, context), executeTool("get_recent_rainfall", args, context)
      ]);
      const horizon = args.horizon || "month";
      const actions = [
        "Start with soil preparation and watering rhythm before adding more plants.",
        "Prioritize plants matched to sun, drainage, and maintenance tolerance.",
        "Schedule work around rain, wind, frost, and high pollen days."
      ];
      result = withMeta(toolName, { mode: "computed", provider: "JarDIYn planning engine", horizon, dependencies: [zone, soil, weather, noaa, frost, pollen, rain].map((r) => ({ tool: r.tool, summary: r.summary, confidence: r.confidence })), plan: { priorities: ["stabilize conditions", "plant in matched zones", "track tasks"], actions }, summary: `${horizon} plan generated from zone, soil, weather, NOAA alerts, frost, pollen, and rainfall signals.` }, { confidence: "high", next_actions: actions });
      if (context.session_id) actions.forEach((title, idx) => addTask(context.session_id, { title, priority: idx === 0 ? "high" : "medium", due: horizon === "weekend" ? "this weekend" : "this month", source: "generate_garden_plan" }));
      break;
    }
    case "generate_diy_report": {
      const plan = await executeTool("generate_garden_plan", { ...args, horizon: args.timeframe || "week" }, context);
      result = withMeta(toolName, { mode: "computed", provider: "JarDIYn report engine", timeframe: args.timeframe || "week", sections: { do: plan.next_actions || [], watch: ["NOAA/frost updates", "soil moisture after rain", "pollen/wind if working outside"], avoid: ["planting into saturated soil", "fertilizing stressed plants", "spraying during wind or heat"] }, summary: `DIY ${args.timeframe || "week"} report generated with action, watch, and avoid categories.` }, { confidence: "high", next_actions: plan.next_actions || [] });
      break;
    }
    case "property_gis_preview": {
      result = withMeta(toolName, { mode: "adapter-ready", provider: "JarDIYn GIS/photo-ready site preview", site_notes: clean(args.site_notes || "No site notes provided", 1000), preview: { sun: "Confirm with photos or map layer; use profile sun value for now.", drainage: args.drainage || "Use slope/downspout observations.", access: "Keep maintenance paths and hose reach visible in plan.", caution: "Call utility locate before digging, trenching, or installing posts." }, summary: "Property-scale preview created with GIS/photo hooks ready for future layers." }, { confidence: "medium", next_actions: ["Add photos from north/south/east/west views.", "Mark wet spots after the next rain.", "Keep paths and water access in the design."] });
      break;
    }
    default: result = { ok: false, tool: toolName, error: { code: "UNKNOWN_TOOL", message: `Unknown tool ${toolName}. Known tools: ${getToolNames().join(", ")}` } };
  }
  const duration_ms = Date.now() - started;
  if (result.ok !== false) result.duration_ms = duration_ms;
  if (context.session_id) logToolCall({ session_id: context.session_id, tool: toolName, input: args, output_summary: result.summary, mode: result.mode, duration_ms });
  return result;
}

export async function buildDashboard(profile = {}) {
  const p = normalizeGardenProfile(profile);
  const [zone, weather, noaa, frost, pollen, rain, soil] = await Promise.all([
    executeTool("get_garden_zone", p), executeTool("get_weather_forecast", p), executeTool("get_noaa_alerts", p), executeTool("get_frost_alerts", p), executeTool("get_pollen_forecast", p), executeTool("get_recent_rainfall", p), executeTool("get_soil_profile", p)
  ]);
  const widgets = { zone, weather, noaa, frost, pollen, rain, soil };
  return {
    profile: p,
    checked_at: isoNow(),
    headline: "Garden operating signals aligned by source category.",
    categories: [
      { id: "weather", label: "Weather", tool: "get_weather_forecast", widget: weather },
      { id: "noaa", label: "NOAA / NWS", tool: "get_noaa_alerts", widget: noaa },
      { id: "frost", label: "Frost", tool: "get_frost_alerts", widget: frost },
      { id: "pollen", label: "Pollen", tool: "get_pollen_forecast", widget: pollen },
      { id: "rain", label: "Rain / Watering", tool: "get_recent_rainfall", widget: rain },
      { id: "soil", label: "Soil / Zone", tool: "get_soil_profile", widget: soil, secondary: zone }
    ],
    widgets,
    priorities: derivePriorities(widgets),
    do_now: ["Check soil moisture before watering.", "Use the next calm dry window for pruning or planting.", "Protect tender plants if frost risk moves above watch."],
    avoid: ["Do not work wet clay soil.", "Do not spray during wind, heat, or bloom-heavy pollinator periods.", "Do not plant marginal perennials without confirming zone and drainage."]
  };
}

function derivePriorities(widgets) {
  const priorities = [];
  if (widgets.frost?.data?.level && widgets.frost.data.level !== "low") priorities.push({ priority: "high", title: "Protect tender plants", reason: widgets.frost.summary });
  if (widgets.rain?.data?.total_inches < 0.5) priorities.push({ priority: "medium", title: "Check watering", reason: widgets.rain.summary });
  if (widgets.pollen?.data?.level === "High") priorities.push({ priority: "low", title: "Time outdoor work around pollen", reason: widgets.pollen.summary });
  priorities.push({ priority: "medium", title: "Match planting to soil and sun", reason: widgets.soil?.summary || "Soil and exposure determine long-term success." });
  return priorities.slice(0, 5);
}

export function responseEnvelopeData(result) { return result; }
