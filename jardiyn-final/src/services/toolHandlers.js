/**
 * JarDIYn — Tool Handlers
 * ========================
 * Requirement 6: When the model emits a tool_use block, this module
 * executes the named tool and returns a structured result that is
 * appended to the message thread as a tool_result block.
 *
 * Each handler:
 *  - Accepts the raw `input` object from the model's tool_use block
 *  - Calls the real external API (or a clearly-labeled sandbox mock)
 *  - Returns a plain JS object that is JSON-serialized into tool_result.content
 *  - Attaches provenance fields so every AI output is traceable
 *
 * To swap sandbox → production: replace the body of each handler
 * with a real HTTP call. The agentic loop in agentLoop.js does not
 * change — only these handlers do.
 */

import { TOOL_LABELS } from "./tools.js";
import { liveGardenZone, liveWeatherForecast, liveSoilData, liveGeocodeZip, LIVE_MODE } from "./liveApis.js";

// ─── Resolve coordinates: use lat/lng if present, else geocode the ZIP ────────
async function resolveCoords(input) {
  if (input.latitude != null && input.longitude != null)
    return { latitude: input.latitude, longitude: input.longitude };
  if (input.zip_code) {
    const geo = await liveGeocodeZip(input.zip_code);
    if (geo) return { latitude: geo.latitude, longitude: geo.longitude };
  }
  return { latitude: null, longitude: null };
}

// ─── Provenance helper ────────────────────────────────────────────────────────
function provenance(source, mode = "sandbox") {
  return {
    source,
    mode,              // "sandbox" | "live"
    generated_at: new Date().toISOString(),
    contains_estimates: mode === "sandbox"
  };
}

// ─── Handler: identify_plant ──────────────────────────────────────────────────
/**
 * Calls Plant.id API (or sandbox mock) to identify species / pest / disease.
 * Returns candidates ranked by confidence with organic remedy.
 *
 * Production swap: POST https://api.plant.id/v3/identification
 *   with image in base64 and optional lat/lng for geo filtering.
 */
export async function handleIdentifyPlant(input) {
  console.log(`[tool] identify_plant called — symptom: "${input.symptom_description?.slice(0, 60)}"`);

  // ── Sandbox mock (replace with real Plant.id API call in production) ──
  const zone = input.garden_zone || "unknown";
  const hasBrowning = input.symptom_description?.toLowerCase().includes("brown");
  const hasYellowing = input.symptom_description?.toLowerCase().includes("yellow");
  const hasBugs = input.symptom_description?.toLowerCase().includes("bug") ||
                  input.symptom_description?.toLowerCase().includes("pest");

  let candidates;
  if (hasBugs) {
    candidates = [
      { species: "Aphid (Aphididae)", confidence: 0.82, type: "pest",
        remedy: "Spray with neem oil solution (2 tsp / quart water) every 7 days. Introduce ladybugs." },
      { species: "Spider mite (Tetranychidae)", confidence: 0.61, type: "pest",
        remedy: "Increase humidity, apply insecticidal soap. Isolate affected plants." }
    ];
  } else if (hasYellowing) {
    candidates = [
      { species: "Nitrogen deficiency", confidence: 0.79, type: "deficiency",
        remedy: "Apply balanced organic fertilizer (10-10-10). Top-dress with compost." },
      { species: "Overwatering / root rot", confidence: 0.65, type: "condition",
        remedy: "Reduce watering frequency. Ensure drainage. Check roots for rot." }
    ];
  } else if (hasBrowning) {
    candidates = [
      { species: "Leaf scorch (environmental)", confidence: 0.74, type: "condition",
        remedy: "Provide afternoon shade. Increase watering. Mulch root zone." },
      { species: "Fungal leaf spot (Cercospora)", confidence: 0.58, type: "disease",
        remedy: "Remove affected leaves. Apply copper fungicide. Improve air circulation." }
    ];
  } else {
    candidates = [
      { species: "Unidentified — image or description needed", confidence: 0.30, type: "unknown",
        remedy: "Please provide an image or more detailed symptom description." }
    ];
  }

  const topConfidence = candidates[0].confidence;
  return {
    tool: "identify_plant",
    label: TOOL_LABELS.identify_plant,
    candidates,
    top_confidence: topConfidence,
    needs_human_review: topConfidence < 0.6,
    zone_context: zone,
    provenance: provenance("plant.id/sandbox")
  };
}

// ─── Handler: get_garden_zone ─────────────────────────────────────────────────
/**
 * Looks up USDA hardiness zone and frost dates.
 *
 * Production swap: POST https://phzmapi.org/ or USDA Plant Hardiness API
 *   with lat/lng or ZIP code.
 */
export async function handleGetGardenZone(input) {
  console.log(`[tool] get_garden_zone called — zip: ${input.zip_code}, lat: ${input.latitude}`);

  // ── Try live USDA PHZM API first (falls back to mock on any failure) ──
  const live = await liveGardenZone(input.zip_code);
  if (live) { console.log(`[tool] get_garden_zone → LIVE (${live.hardiness_zone})`); return live; }

  // ── Sandbox mock: returns realistic zone data keyed to ZIP prefix ──
  const zip = input.zip_code || "";
  const prefix = parseInt(zip.slice(0, 2), 10) || 0;

  let zone, first_frost, last_frost, avg_rainfall_inches, microclimate_note;

  if (prefix <= 19 || (prefix >= 60 && prefix <= 69)) {
    // Northeast / Midwest
    zone = "6a"; first_frost = "2024-10-15"; last_frost = "2025-04-20";
    avg_rainfall_inches = 42; microclimate_note = "Cold winters; spring arrives late April.";
  } else if (prefix >= 90 && prefix <= 96) {
    // California / Pacific Southwest
    zone = "10a"; first_frost = null; last_frost = "2025-01-15";
    avg_rainfall_inches = 14; microclimate_note = "Mild winters; summer drought; marine layer influence.";
  } else if (prefix >= 30 && prefix <= 39) {
    // Southeast
    zone = "8a"; first_frost = "2024-11-20"; last_frost = "2025-03-01";
    avg_rainfall_inches = 50; microclimate_note = "Humid subtropical; long growing season.";
  } else {
    // Default mid-Atlantic
    zone = "7b"; first_frost = "2024-11-05"; last_frost = "2025-03-25";
    avg_rainfall_inches = 44; microclimate_note = "Moderate four-season climate.";
  }

  return {
    tool: "get_garden_zone",
    label: TOOL_LABELS.get_garden_zone,
    hardiness_zone: zone,
    first_frost,
    last_frost,
    avg_rainfall_inches,
    microclimate_note,
    provenance: provenance("usda-phzm/sandbox")
  };
}

// ─── Handler: get_soil_data ───────────────────────────────────────────────────
/**
 * Returns soil type and health data from USDA Web Soil Survey.
 *
 * Production swap: USDA SoilWeb API
 *   GET https://casoilresource.lawr.ucdavis.edu/api/json/
 *   with lat/lng parameters.
 */
export async function handleGetSoilData(input) {
  console.log(`[tool] get_soil_data called — lat: ${input.latitude}, zip: ${input.zip_code}`);

  // ── Try live SoilGrids API first (falls back to mock on any failure) ──
  const coords = await resolveCoords(input);
  const live = await liveSoilData(coords.latitude, coords.longitude);
  if (live) { console.log(`[tool] get_soil_data → LIVE (${live.texture})`); return live; }

  // ── Sandbox mock ──
  return {
    tool: "get_soil_data",
    label: TOOL_LABELS.get_soil_data,
    soil_series: "Chillum silt loam (sandbox estimate)",
    texture: "silt loam",
    ph_range: { min: 6.0, max: 6.8 },
    drainage_class: "well drained",
    lcc: "IIe",
    organic_matter_pct: 2.4,
    amendment_suggestions: [
      "Add 2–3 inches of compost annually to improve structure",
      "Consider lime application if pH drops below 6.0",
      "Mulch to retain moisture during dry periods"
    ],
    provenance: provenance("usda-ssurgo/sandbox")
  };
}

// ─── Handler: get_weather_forecast ───────────────────────────────────────────
/**
 * Returns current conditions and 7-day forecast.
 *
 * Production swap: OpenWeatherMap One Call API 3.0
 *   GET https://api.openweathermap.org/data/3.0/onecall
 *   with lat, lon, and API key.
 */
export async function handleGetWeatherForecast(input) {
  console.log(`[tool] get_weather_forecast called — lat: ${input.latitude}, zip: ${input.zip_code}`);

  // ── Try live Open-Meteo API first (falls back to mock on any failure) ──
  const coords = await resolveCoords(input);
  const live = await liveWeatherForecast(coords.latitude, coords.longitude);
  if (live) { console.log(`[tool] get_weather_forecast → LIVE (${live.watering_recommendation})`); return live; }

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const precip = [20, 10, 60, 80, 30, 10, 15][i];
    return {
      date: d.toISOString().split("T")[0],
      high_f: 72 + Math.round(Math.random() * 10 - 5),
      low_f:  54 + Math.round(Math.random() * 8 - 4),
      precip_chance_pct: precip,
      conditions: precip > 50 ? "rainy" : precip > 25 ? "partly cloudy" : "sunny"
    };
  });

  const rainDays = days.filter(d => d.precip_chance_pct > 50).length;
  const watering = rainDays >= 3 ? "skip" : rainDays >= 1 ? "light" : "normal";

  return {
    tool: "get_weather_forecast",
    label: TOOL_LABELS.get_weather_forecast,
    current: { temp_f: 68, humidity_pct: 62, conditions: "partly cloudy" },
    forecast: days,
    frost_warning: false,
    watering_recommendation: watering,
    watering_explanation: rainDays >= 3
      ? "Significant rain expected this week — skip irrigation."
      : rainDays >= 1
        ? "Some rain expected — reduce watering by half."
        : "Dry week ahead — maintain normal watering schedule.",
    provenance: provenance("openweathermap/sandbox")
  };
}

// ─── Handler: generate_diy_report ────────────────────────────────────────────
/**
 * Generates a personalized DIY garden report.
 * In production this calls Claude again with a specialist report prompt
 * and RAG context. Here it returns a structured sandbox report.
 *
 * Production swap: call Claude with src/prompts/report.md system prompt
 *   plus garden profile + season context.
 */
export async function handleGenerateDiyReport(input) {
  console.log(`[tool] generate_diy_report called — zone: ${input.garden_profile?.hardiness_zone}`);

  const profile = input.garden_profile || {};
  const zone = profile.hardiness_zone || "7b";
  const month = input.month || new Date().getMonth() + 1;
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthName = monthNames[month - 1];

  const report_markdown = `
# JarDIYn Garden Report — ${monthName}
**Site:** ${profile.site_name || "Your Garden"} · **Zone:** ${zone}

## Priority Actions This Month
1. Check soil moisture at 2-inch depth before each watering
2. Scout for early pest activity on new growth
3. Apply balanced organic fertilizer if plants show slow growth

## Soil Health
Your ${profile.soil_type || "soil"} is entering the active growing season.
${month >= 3 && month <= 5 ? "Spring: incorporate compost now before planting." : ""}
${month >= 6 && month <= 8 ? "Summer: mulch heavily to retain moisture." : ""}
${month >= 9 && month <= 11 ? "Fall: plant cover crops to rebuild organic matter." : ""}

## Watering Guide
${zone >= "9" ? "Water deeply 2× per week in warm months." : "Water when top 2 inches of soil are dry."}
Morning watering reduces fungal risk.

## Pest Watch
- Aphids: check undersides of leaves on new growth
- Slugs: set beer traps after rain events
- ${month >= 6 ? "Japanese beetles: hand-pick in morning when sluggish" : "Overwintering eggs: inspect soil near plant bases"}

## Seasonal Tasks
${month <= 3 || month === 12 ? "- Start seeds indoors 6–8 weeks before last frost\n- Order seeds and bare-root plants now" : ""}
${month >= 4 && month <= 6 ? "- Harden off seedlings before transplanting\n- Apply pre-emergent weed barrier" : ""}
${month >= 7 && month <= 9 ? "- Harvest regularly to encourage production\n- Begin planting fall crops" : ""}
`.trim();

  return {
    tool: "generate_diy_report",
    label: TOOL_LABELS.generate_diy_report,
    report_markdown,
    summary: `${monthName} priorities for Zone ${zone}: soil moisture, pest scouting, and seasonal planting tasks.`,
    priority_actions: [
      "Check soil moisture before watering",
      "Scout for early pest activity",
      "Apply organic fertilizer if growth is slow"
    ],
    model_version: "claude-sonnet-4-6",
    prompt_version: "report-v1.0",
    confidence: 0.84,
    citations: ["USDA Plant Hardiness Zone Map", "University Extension IPM Guidelines"],
    provenance: provenance("jardiyn-report-engine/sandbox")
  };
}

// ─── Handler: lookup_plant_database ──────────────────────────────────────────
/**
 * Searches for zone-appropriate plants.
 *
 * Production swap: Trefle API (https://trefle.io/api/v1/plants)
 *   with zone, sun, water filter params.
 */
export async function handleLookupPlantDatabase(input) {
  console.log(`[tool] lookup_plant_database called — zone: ${input.hardiness_zone}, type: ${input.plant_type}`);

  const allPlants = [
    { common_name: "Purple Coneflower",    latin_name: "Echinacea purpurea",
      zone_range: "3-9",  water_needs: "low",    sun_needs: "full_sun",
      bloom_season: "summer", mature_height_ft: 3,
      companion_plants: ["Black-eyed Susan", "Bee balm"],
      avoid_near: [] },
    { common_name: "Bee Balm",             latin_name: "Monarda didyma",
      zone_range: "4-9",  water_needs: "medium", sun_needs: "full_sun",
      bloom_season: "summer", mature_height_ft: 4,
      companion_plants: ["Coneflower", "Yarrow"],
      avoid_near: ["Fennel"] },
    { common_name: "Coral Bells",          latin_name: "Heuchera sanguinea",
      zone_range: "4-9",  water_needs: "low",    sun_needs: "partial_shade",
      bloom_season: "spring", mature_height_ft: 1.5,
      companion_plants: ["Hostas", "Ferns"],
      avoid_near: [] },
    { common_name: "Tomato (Bush)",        latin_name: "Solanum lycopersicum",
      zone_range: "3-11", water_needs: "high",   sun_needs: "full_sun",
      bloom_season: "summer", mature_height_ft: 3,
      companion_plants: ["Basil", "Marigold"],
      avoid_near: ["Fennel", "Brassicas"] },
    { common_name: "Rosemary",             latin_name: "Salvia rosmarinus",
      zone_range: "7-11", water_needs: "low",    sun_needs: "full_sun",
      bloom_season: "spring", mature_height_ft: 4,
      companion_plants: ["Lavender", "Sage"],
      avoid_near: ["Cucumbers"] },
    { common_name: "Oakleaf Hydrangea",    latin_name: "Hydrangea quercifolia",
      zone_range: "5-9",  water_needs: "medium", sun_needs: "partial_shade",
      bloom_season: "summer", mature_height_ft: 8,
      companion_plants: ["Ferns", "Hostas"],
      avoid_near: [] }
  ];

  // Filter by zone (simplified: check if user's zone number falls in range)
  const userZoneNum = parseInt((input.hardiness_zone || "7b").replace(/[ab]$/, ""), 10);
  let matches = allPlants.filter(p => {
    const [minZ, maxZ] = p.zone_range.split("-").map(Number);
    return userZoneNum >= minZ && userZoneNum <= maxZ;
  });

  if (input.sun_exposure)  matches = matches.filter(p => p.sun_needs === input.sun_exposure);
  if (input.water_needs)   matches = matches.filter(p => p.water_needs === input.water_needs);
  if (input.plant_type === "herb")       matches = matches.filter(p => p.common_name === "Rosemary" || p.latin_name.includes("Salvia"));
  if (input.plant_type === "vegetable")  matches = matches.filter(p => p.latin_name.includes("Solanum"));
  if (input.search_query) {
    const q = input.search_query.toLowerCase();
    matches = matches.filter(p =>
      p.common_name.toLowerCase().includes(q) ||
      p.latin_name.toLowerCase().includes(q) ||
      p.companion_plants.some(c => c.toLowerCase().includes(q))
    );
  }

  return {
    tool: "lookup_plant_database",
    label: TOOL_LABELS.lookup_plant_database,
    query: { hardiness_zone: input.hardiness_zone, plant_type: input.plant_type,
             sun_exposure: input.sun_exposure, water_needs: input.water_needs },
    matching_plants: matches.slice(0, 10),
    result_count: matches.length,
    provenance: provenance("trefle/sandbox")
  };
}

// ─── Master dispatcher ────────────────────────────────────────────────────────
/**
 * Routes a tool_use block (name + input) to the correct handler.
 * Called by the agentic loop in agentLoop.js.
 *
 * Requirement 6: This is the execution layer. The model picks the name;
 * this function runs the real code and returns the result.
 */
export async function dispatchTool(toolName, input) {
  const start = Date.now();
  let result;

  try {
    switch (toolName) {
      case "identify_plant":        result = await handleIdentifyPlant(input);       break;
      case "get_garden_zone":       result = await handleGetGardenZone(input);       break;
      case "get_soil_data":         result = await handleGetSoilData(input);         break;
      case "get_weather_forecast":  result = await handleGetWeatherForecast(input);  break;
      case "generate_diy_report":   result = await handleGenerateDiyReport(input);   break;
      case "lookup_plant_database": result = await handleLookupPlantDatabase(input); break;
      default:
        result = { error: `Unknown tool: ${toolName}`, known_tools: Object.keys(TOOL_LABELS) };
    }
  } catch (err) {
    result = { error: `Tool execution failed: ${err.message}`, tool: toolName };
    console.error(`[tool:error] ${toolName}:`, err);
  }

  const ms = Date.now() - start;
  console.log(`[tool:done] ${toolName} completed in ${ms}ms`);
  return result;
}
