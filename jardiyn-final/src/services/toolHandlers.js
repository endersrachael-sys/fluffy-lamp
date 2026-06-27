import { TOOL_LABELS } from "./tools.js";

const LIVE_APIS = process.env.LIVE_APIS !== "false";
const FETCH_TIMEOUT_MS = 4500;

function timeoutSignal(ms = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timeout) };
}

async function safeFetchJson(url) {
  if (!LIVE_APIS) return null;
  const { signal, cancel } = timeoutSignal();
  try {
    const res = await fetch(url, { signal, headers: { "user-agent": "JarDIYn/3.0" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    cancel();
  }
}

function provenance(source, status = "fallback-estimate", confidence = "medium") {
  return {
    source,
    status,
    confidence,
    generated_at: new Date().toISOString(),
    note: status.includes("fallback") ? "Fallback estimates are useful for planning but should be checked locally." : "Live public data source used where available."
  };
}

function normalizeZip(zip) {
  return String(zip || "").trim().slice(0, 5);
}

async function geocodeZip(zip) {
  const z = normalizeZip(zip);
  if (!z) return null;
  const data = await safeFetchJson(`https://api.zippopotam.us/us/${encodeURIComponent(z)}`);
  const place = data?.places?.[0];
  if (!place) return null;
  return {
    zip: z,
    city: place["place name"],
    state: place["state abbreviation"],
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    source: "zippopotam.us"
  };
}

async function resolveLocation(input = {}) {
  if (Number.isFinite(input.latitude) && Number.isFinite(input.longitude)) {
    return { latitude: Number(input.latitude), longitude: Number(input.longitude), source: "user-coordinates" };
  }
  if (input.zip_code) return await geocodeZip(input.zip_code);
  return null;
}

function estimateZoneByZip(zip) {
  const z = normalizeZip(zip);
  const prefix = Number(z.slice(0, 2));
  if (!prefix) return { zone: "unknown", region: "unknown", lastFrost: null, firstFrost: null };
  if (prefix >= 48 && prefix <= 49) return { zone: "6a/6b", region: "West Michigan / Great Lakes", lastFrost: "late April to mid-May", firstFrost: "early to mid-October" };
  if (prefix >= 10 && prefix <= 19) return { zone: "6b/7a", region: "Northeast / Mid-Atlantic", lastFrost: "mid-April", firstFrost: "late October" };
  if (prefix >= 30 && prefix <= 39) return { zone: "7b/8a", region: "Southeast", lastFrost: "March", firstFrost: "November" };
  if (prefix >= 60 && prefix <= 69) return { zone: "5b/6a", region: "Upper Midwest", lastFrost: "late April to May", firstFrost: "October" };
  if (prefix >= 90 && prefix <= 96) return { zone: "9b/10a", region: "California / Pacific", lastFrost: "low frost risk in many coastal areas", firstFrost: "variable" };
  if (prefix >= 73 && prefix <= 79) return { zone: "7b/8a", region: "Southern Plains", lastFrost: "March to April", firstFrost: "October to November" };
  return { zone: "7a", region: "general U.S. planning estimate", lastFrost: "spring", firstFrost: "fall" };
}

export async function handleGetGardenZone(input = {}) {
  const location = await resolveLocation(input);
  const zip = normalizeZip(input.zip_code || location?.zip);
  const estimate = estimateZoneByZip(zip);
  return {
    tool: "get_garden_zone",
    label: TOOL_LABELS.get_garden_zone,
    hardiness_zone: estimate.zone,
    region: estimate.region,
    last_frost_window: estimate.lastFrost,
    first_frost_window: estimate.firstFrost,
    location,
    microclimate_notes: [
      "Use this as planning context, not a measured site survey.",
      "Buildings, slope, wind exposure, paved surfaces, and lake effects can shift real garden conditions."
    ],
    user_safe_summary: `Planning estimate: ${estimate.region}, zone ${estimate.zone}. Confirm with local extension or USDA map before high-cost plant purchases.`,
    provenance: provenance("ZIP/region fallback + optional public geocoding", location ? "live-or-fallback" : "fallback-estimate", "medium")
  };
}

export async function handleGetSoilProfile(input = {}) {
  const location = await resolveLocation(input);
  if (location?.latitude && location?.longitude) {
    const lon = encodeURIComponent(location.longitude);
    const lat = encodeURIComponent(location.latitude);
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=clay&property=sand&property=silt&property=phh2o&depth=0-5cm&value=mean`;
    const soil = await safeFetchJson(url);
    const layers = soil?.properties?.layers || [];
    if (layers.length) {
      const getVal = name => layers.find(l => l.name === name)?.depths?.[0]?.values?.mean;
      const clay = getVal("clay");
      const sand = getVal("sand");
      const silt = getVal("silt");
      const phRaw = getVal("phh2o");
      const ph = phRaw ? Math.round((phRaw / 10) * 10) / 10 : null;
      const texture = clay > 350 ? "clay-heavy" : sand > 550 ? "sandy" : silt > 450 ? "silty/loam" : "mixed loam";
      return {
        tool: "get_soil_profile",
        label: TOOL_LABELS.get_soil_profile,
        texture,
        clay_g_per_kg: clay ?? null,
        sand_g_per_kg: sand ?? null,
        silt_g_per_kg: silt ?? null,
        ph_estimate: ph,
        drainage_context: input.drainage || "not user-reported",
        amendment_suggestions: buildSoilSuggestions(texture, input.drainage),
        user_safe_summary: `SoilGrids-style estimate suggests ${texture}. Treat as regional context; confirm with a soil test before major amendments.`,
        provenance: provenance("SoilGrids public API", "live", "medium")
      };
    }
  }

  const userSoil = input.user_soil || input.soil_type || "unknown";
  const texture = userSoil === "unknown" ? "unknown / user should verify" : userSoil;
  return {
    tool: "get_soil_profile",
    label: TOOL_LABELS.get_soil_profile,
    texture,
    drainage_context: input.drainage || "unknown",
    amendment_suggestions: buildSoilSuggestions(texture, input.drainage),
    user_safe_summary: `Using user-provided/fallback soil context: ${texture}. A real soil test is recommended for pH and nutrient decisions.`,
    provenance: provenance("Garden Passport + fallback soil guidance", "user-provided-or-fallback", "medium")
  };
}

function buildSoilSuggestions(texture = "", drainage = "") {
  const t = String(texture).toLowerCase();
  const d = String(drainage).toLowerCase();
  const suggestions = [];
  if (t.includes("clay") || d.includes("poor")) {
    suggestions.push("Avoid working clay when wet; it compacts easily.");
    suggestions.push("Add compost and mulch over time rather than trying to 'fix' everything in one weekend.");
    suggestions.push("Choose clay-tolerant plants and consider raised beds for drainage-sensitive herbs/vegetables.");
  } else if (t.includes("sand")) {
    suggestions.push("Add compost to improve water and nutrient retention.");
    suggestions.push("Use mulch to reduce moisture swings.");
    suggestions.push("Prefer drought-tolerant plants unless irrigation is reliable.");
  } else {
    suggestions.push("Add compost annually and mulch exposed soil.");
    suggestions.push("Use a soil test before applying lime, sulfur, or fertilizer.");
    suggestions.push("Match plants to actual drainage, not just soil name.");
  }
  return suggestions;
}

export async function handleGetWeatherContext(input = {}) {
  const location = await resolveLocation(input);
  if (location?.latitude && location?.longitude) {
    const lat = encodeURIComponent(location.latitude);
    const lon = encodeURIComponent(location.longitude);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&temperature_unit=fahrenheit&forecast_days=7&timezone=auto`;
    const weather = await safeFetchJson(url);
    if (weather?.daily?.time) {
      const days = weather.daily.time.map((date, i) => ({
        date,
        high_f: weather.daily.temperature_2m_max?.[i],
        low_f: weather.daily.temperature_2m_min?.[i],
        precip_probability_pct: weather.daily.precipitation_probability_max?.[i],
        precip_inches: weather.daily.precipitation_sum?.[i]
      }));
      const rainDays = days.filter(d => (d.precip_probability_pct || 0) >= 50 || (d.precip_inches || 0) > 0.15).length;
      const lows = days.map(d => d.low_f).filter(Number.isFinite);
      const frostRisk = lows.some(v => v <= 36);
      const heatRisk = days.some(d => (d.high_f || 0) >= 88);
      return {
        tool: "get_weather_context",
        label: TOOL_LABELS.get_weather_context,
        location,
        current: weather.current || null,
        forecast: days,
        rain_signal: rainDays >= 3 ? "wet week" : rainDays >= 1 ? "some rain expected" : "dry week",
        frost_risk: frostRisk,
        heat_risk: heatRisk,
        watering_recommendation: rainDays >= 3 ? "skip or reduce watering" : rainDays >= 1 ? "check soil before watering" : "water normally if soil is dry",
        user_safe_summary: frostRisk ? "Cold lows are possible; protect tender plants." : heatRisk ? "Heat stress is possible; water deeply in the morning and mulch." : "No major frost/heat signal from the 7-day context.",
        provenance: provenance("Open-Meteo public forecast", "live", "medium-high")
      };
    }
  }

  return {
    tool: "get_weather_context",
    label: TOOL_LABELS.get_weather_context,
    rain_signal: "unknown",
    frost_risk: false,
    heat_risk: false,
    watering_recommendation: "Check soil moisture 2 inches deep before watering.",
    user_safe_summary: "Weather data was unavailable, so use the soil-moisture check before watering.",
    provenance: provenance("fallback weather guidance", "fallback-estimate", "low-medium")
  };
}

const PLANTS = [
  { common: "Purple coneflower", latin: "Echinacea purpurea", zones: [3, 9], sun: ["full_sun", "partial_shade"], soil: ["loam", "clay loam", "clay", "sandy loam"], water: "low", goals: ["pollinators", "native plants", "low maintenance"], notes: "Durable pollinator plant; tolerate average soils once established." },
  { common: "Black-eyed Susan", latin: "Rudbeckia hirta", zones: [3, 9], sun: ["full_sun", "partial_shade"], soil: ["loam", "clay loam", "clay"], water: "low", goals: ["pollinators", "native plants", "cut flowers"], notes: "Strong beginner plant; can self-seed." },
  { common: "Bee balm", latin: "Monarda fistulosa", zones: [3, 9], sun: ["full_sun", "partial_shade"], soil: ["loam", "clay loam"], water: "medium", goals: ["pollinators", "native plants"], notes: "Excellent for bees/hummingbirds; give airflow to reduce mildew." },
  { common: "Little bluestem", latin: "Schizachyrium scoparium", zones: [3, 9], sun: ["full_sun"], soil: ["sandy loam", "loam", "clay loam"], water: "low", goals: ["native plants", "low maintenance"], notes: "Good structure and winter interest; avoid wet heavy shade." },
  { common: "Oakleaf hydrangea", latin: "Hydrangea quercifolia", zones: [5, 9], sun: ["partial_shade"], soil: ["loam", "clay loam"], water: "medium", goals: ["low maintenance", "curb appeal"], notes: "Shrub option for part shade; needs room." },
  { common: "Coral bells", latin: "Heuchera spp.", zones: [4, 9], sun: ["partial_shade", "full_shade"], soil: ["loam", "clay loam"], water: "medium", goals: ["low maintenance", "curb appeal"], notes: "Good edge plant for shade; avoid soggy crowns." },
  { common: "Hosta", latin: "Hosta spp.", zones: [3, 9], sun: ["partial_shade", "full_shade"], soil: ["loam", "clay loam"], water: "medium", goals: ["low maintenance"], notes: "Reliable shade plant but deer love it." },
  { common: "Tomato", latin: "Solanum lycopersicum", zones: [3, 11], sun: ["full_sun"], soil: ["loam", "sandy loam"], water: "high", goals: ["vegetables"], notes: "Needs consistent watering, airflow, and 6+ hours sun." },
  { common: "Basil", latin: "Ocimum basilicum", zones: [10, 11], sun: ["full_sun"], soil: ["loam", "sandy loam"], water: "medium", goals: ["herbs", "vegetables"], notes: "Annual in cold zones; hates frost." },
  { common: "Sedge", latin: "Carex spp.", zones: [4, 9], sun: ["partial_shade", "full_shade"], soil: ["loam", "clay loam", "clay"], water: "medium", goals: ["native plants", "low maintenance"], notes: "Useful matrix/groundcover option for shade depending on species." }
];

function zoneNumber(zone = "") {
  const n = parseInt(String(zone).match(/\d+/)?.[0] || "6", 10);
  return Number.isFinite(n) ? n : 6;
}

export async function handleLookupPlantDatabase(input = {}) {
  const zone = zoneNumber(input.hardiness_zone);
  const sun = input.sun_exposure;
  const soil = String(input.soil_type || "").toLowerCase();
  const goals = (input.goals || []).map(g => String(g).toLowerCase());
  const q = String(input.search_query || "").toLowerCase();
  let scored = PLANTS.map(p => {
    let score = 0;
    if (zone >= p.zones[0] && zone <= p.zones[1]) score += 3;
    if (!sun || p.sun.includes(sun)) score += 2;
    if (!soil || p.soil.some(s => soil.includes(s) || s.includes(soil))) score += 1;
    score += goals.filter(g => p.goals.includes(g)).length;
    if (q && `${p.common} ${p.latin} ${p.notes}`.toLowerCase().includes(q)) score += 2;
    return { ...p, score };
  }).filter(p => p.score >= 3).sort((a, b) => b.score - a.score);

  if (!scored.length) scored = PLANTS.slice(0, 5).map(p => ({ ...p, score: 1 }));

  return {
    tool: "lookup_plant_database",
    label: TOOL_LABELS.lookup_plant_database,
    matching_plants: scored.slice(0, 8).map(p => ({
      common_name: p.common,
      latin_name: p.latin,
      zone_range: `${p.zones[0]}-${p.zones[1]}`,
      sun_needs: p.sun,
      water_needs: p.water,
      goals: p.goals,
      notes: p.notes,
      match_score: p.score
    })),
    avoid_notes: buildAvoidNotes(input),
    user_safe_summary: "Curated plant matches based on zone/sun/soil/goals. Confirm availability and local invasiveness with a local nursery or Extension office.",
    provenance: provenance("JarDIYn curated starter plant cache", "curated-fallback", "medium")
  };
}

function buildAvoidNotes(profile = {}) {
  const notes = [];
  const soil = String(profile.soil_type || "").toLowerCase();
  const sun = String(profile.sun_exposure || "").toLowerCase();
  const problems = String((profile.known_problems || []).join(" ")).toLowerCase();
  if (soil.includes("clay") || problems.includes("drain")) notes.push("Avoid drainage-sensitive Mediterranean herbs directly in wet clay unless raised or amended.");
  if (sun.includes("shade")) notes.push("Avoid full-sun vegetables and prairie plants in deep shade.");
  if (String(profile.deer_pressure || "").toLowerCase().includes("high")) notes.push("Avoid hosta/tulips/daylilies without deer protection.");
  if (!notes.length) notes.push("Avoid buying plants before confirming mature size, light, water, and maintenance fit.");
  return notes;
}

export async function handleDiagnosePlantIssue(input = {}) {
  const s = String(input.symptom_description || "").toLowerCase();
  const likely = [];
  if (/yellow|chlorosis/.test(s)) likely.push({ cause: "watering/drainage imbalance or nutrient stress", confidence: "medium", first_check: "Check soil moisture 2 inches down and inspect drainage before fertilizing." });
  if (/spot|spots|blotch|mildew|fung/.test(s)) likely.push({ cause: "leaf disease or airflow problem", confidence: "medium", first_check: "Remove worst leaves, avoid overhead watering, improve airflow, and photograph progression." });
  if (/bug|pest|holes|chew|aphid|mite/.test(s)) likely.push({ cause: "insect pressure", confidence: "medium", first_check: "Inspect undersides of leaves in morning; identify pest before spraying." });
  if (/wilt|droop|dying|dead/.test(s)) likely.push({ cause: "transplant shock, water stress, root issue, or heat stress", confidence: "medium-low", first_check: "Check root zone moisture and recent heat/watering changes." });
  if (!likely.length) likely.push({ cause: "insufficient context", confidence: "low", first_check: "Provide plant name, photo, watering pattern, sun exposure, and how fast symptoms appeared." });
  return {
    tool: "diagnose_plant_issue",
    label: TOOL_LABELS.diagnose_plant_issue,
    likely_causes: likely,
    safe_next_steps: [
      "Do not apply pesticide until the pest or disease is identified.",
      "Check water/drainage first; many plant problems are site-condition problems.",
      "Remove severely damaged foliage only if it will not strip the plant bare.",
      "Use local Extension or a nursery pro for persistent or high-value plants."
    ],
    user_safe_summary: "This is triage, not a confirmed diagnosis. Good photos and local confirmation improve accuracy.",
    provenance: provenance("JarDIYn symptom triage rules", "curated-fallback", "medium")
  };
}

export async function handlePlanCheck(input = {}) {
  const profile = input.garden_profile || {};
  const plan = String(input.plan_text || "the current garden idea");
  const plants = await handleLookupPlantDatabase({
    hardiness_zone: profile.hardiness_zone || profile.zone || profile.usda_zone,
    soil_type: profile.soil_type,
    sun_exposure: profile.sun_exposure,
    goals: profile.goals || []
  });
  const risks = [];
  const soil = String(profile.soil_type || "").toLowerCase();
  const sun = String(profile.sun_exposure || "").toLowerCase();
  const maintenance = String(profile.maintenance_tolerance || "").toLowerCase();
  if (soil.includes("clay")) risks.push("Heavy/clay soil can drown drainage-sensitive plants and punish rushed planting.");
  if (sun.includes("shade")) risks.push("Shade limits vegetables and many high-bloom pollinator plants.");
  if (maintenance.includes("low")) risks.push("Avoid high-maintenance annual-heavy designs unless the user wants recurring work.");
  if (String(profile.deer_pressure || "").toLowerCase().includes("high")) risks.push("Deer pressure can wipe out attractive beginner plants without protection.");
  if (!risks.length) risks.push("Main risk is buying before confirming mature size, water needs, and maintenance fit.");

  return {
    tool: "plan_check",
    label: TOOL_LABELS.plan_check,
    plan_reviewed: plan.slice(0, 500),
    what_looks_good: [
      "Using the Garden Passport before buying plants is the right first move.",
      "The plan can be improved by matching plants to soil, sun, water, and maintenance tolerance."
    ],
    what_may_fail: risks,
    what_i_would_change: [
      "Start with a smaller first bed or zone instead of the whole yard.",
      "Use 3-5 reliable backbone plants before adding specialty plants.",
      "Separate plants by water needs so one area is not overwatered to save another."
    ],
    next_3_actions: [
      "Mark the sun pattern for one day: morning, midday, afternoon.",
      "Check soil drainage after rain or watering before planting.",
      "Take this short plant list to a local nursery and ask for local substitutions."
    ],
    suggested_plants: plants.matching_plants.slice(0, 5),
    user_safe_summary: "Plan Check flags likely failure points before money is spent.",
    provenance: provenance("Garden Passport + curated plan-check rubric", "curated-fallback", "medium-high")
  };
}

export async function handleGenerateGardenPlan(input = {}) {
  const profile = input.garden_profile || {};
  const soil = await handleGetSoilProfile({ zip_code: profile.zip_code, user_soil: profile.soil_type, drainage: profile.drainage });
  const zone = await handleGetGardenZone({ zip_code: profile.zip_code, latitude: profile.latitude, longitude: profile.longitude });
  const plants = await handleLookupPlantDatabase({
    hardiness_zone: profile.hardiness_zone || zone.hardiness_zone,
    soil_type: profile.soil_type || soil.texture,
    sun_exposure: profile.sun_exposure,
    goals: profile.goals || [],
    maintenance_tolerance: profile.maintenance_tolerance
  });
  return {
    tool: "generate_garden_plan",
    label: TOOL_LABELS.generate_garden_plan,
    site_summary: {
      name: profile.site_name || "My Garden",
      zip_code: profile.zip_code || "not provided",
      zone: profile.hardiness_zone || zone.hardiness_zone,
      soil: profile.soil_type || soil.texture,
      sun: profile.sun_exposure || "not specified",
      goals: profile.goals || [],
      maintenance_tolerance: profile.maintenance_tolerance || "not specified"
    },
    recommended_plants: plants.matching_plants.slice(0, 6),
    avoid_list: plants.avoid_notes,
    soil_prep: soil.amendment_suggestions || [],
    watering_guidance: [
      "Water deeply and less often after establishment unless seedlings/transplants need closer care.",
      "Check soil moisture 2 inches down before watering.",
      "Mulch exposed soil to reduce heat and moisture swings."
    ],
    weekend_tasks: [
      "Walk the site and mark sun/shade zones.",
      "Choose one starter bed or zone instead of redesigning everything.",
      "Buy compost/mulch before buying specialty plants.",
      "Start with 3-5 backbone plants from the recommended list."
    ],
    shopping_list: [
      "Compost",
      "Mulch",
      "Plant labels or stakes",
      "Soil test kit or Extension soil test",
      ...plants.matching_plants.slice(0, 4).map(p => p.common_name)
    ],
    questions_for_local_nursery: [
      "Which of these plants are locally reliable in my ZIP/zone?",
      "Are any on this list invasive or overused locally?",
      "What substitutions do you recommend for my soil and sun?"
    ],
    when_to_call_a_professional: [
      "Standing water, grading, drainage toward the house, retaining walls, large trees, utilities, or permits.",
      "Tree risk, storm damage, pesticide uncertainty, or structural hardscape work."
    ],
    safety_notes: [
      "Do not eat unknown plants or berries based on AI output.",
      "Use pesticides only after identifying the issue and reading the label.",
      "GIS, slope, drainage, and tree-risk features are future roadmap and do not replace professional review."
    ],
    sources_used: [zone.provenance.source, soil.provenance.source, plants.provenance.source, "Garden Passport"],
    user_safe_summary: "Garden Plan generated from Garden Passport plus zone/soil/plant context.",
    provenance: provenance("JarDIYn Garden Plan Builder", "curated-fallback", "medium-high")
  };
}

export async function handlePropertyGisPreview(input = {}) {
  return {
    tool: "property_gis_preview",
    label: TOOL_LABELS.property_gis_preview,
    live_status: "roadmap-only",
    summary: "Future Property Passport can support municipal GIS upload, parcel context, public OSINT layers, satellite imagery, drone partner assessments, and professional handoff reports.",
    guardrail: "This is not live. Future property intelligence must be consent-based, privacy-safe, and must not replace surveys, permits, engineering, arborist review, or legal property analysis.",
    add_on_ladder: ["municipal GIS import", "soil test", "satellite report", "drone partner flyover", "arborist/irrigation/design review"],
    provenance: provenance("JarDIYn roadmap", "future-roadmap", "concept")
  };
}

export async function dispatchTool(toolName, input = {}) {
  const started = Date.now();
  let result;
  switch (toolName) {
    case "get_garden_zone": result = await handleGetGardenZone(input); break;
    case "get_soil_profile": result = await handleGetSoilProfile(input); break;
    case "get_weather_context": result = await handleGetWeatherContext(input); break;
    case "lookup_plant_database": result = await handleLookupPlantDatabase(input); break;
    case "diagnose_plant_issue": result = await handleDiagnosePlantIssue(input); break;
    case "plan_check": result = await handlePlanCheck(input); break;
    case "generate_garden_plan": result = await handleGenerateGardenPlan(input); break;
    case "property_gis_preview": result = await handlePropertyGisPreview(input); break;
    default:
      result = { tool: toolName, error: `Unknown tool: ${toolName}`, provenance: provenance("unknown", "error", "low") };
  }
  return { ...result, duration_ms: Date.now() - started };
}
