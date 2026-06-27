export const TOOL_STATUS = {
  LIVE_OR_FALLBACK: "live-or-fallback",
  CURATED_FALLBACK: "curated-fallback",
  USER_PROVIDED: "user-provided",
  FUTURE_ROADMAP: "future-roadmap"
};

export const JARDIYN_TOOLS = [
  {
    name: "get_garden_zone",
    description: `Looks up or estimates USDA hardiness zone, frost timing, and regional climate context from ZIP code or coordinates. Use when the user's zone is unknown or frost/season timing matters. Do not call if the profile already includes a confirmed zone and the question does not need fresh climate context.`,
    input_schema: {
      type: "object",
      properties: {
        zip_code: { type: "string", description: "US ZIP code for the garden." },
        latitude: { type: "number", description: "Latitude if available." },
        longitude: { type: "number", description: "Longitude if available." }
      },
      required: []
    }
  },
  {
    name: "get_soil_profile",
    description: `Gets soil texture, drainage, clay/sand/silt context, pH context, and soil-prep advice. Use when the user asks about soil, drainage, clay/sand, amendments, or when recommendations depend on soil conditions. Do not call if the profile already has a confirmed soil type and the question is unrelated to soil.`,
    input_schema: {
      type: "object",
      properties: {
        zip_code: { type: "string" },
        latitude: { type: "number" },
        longitude: { type: "number" },
        user_soil: { type: "string", description: "User-provided soil description from the Garden Passport." },
        drainage: { type: "string", description: "User-reported drainage condition." }
      },
      required: []
    }
  },
  {
    name: "get_weather_context",
    description: `Gets current weather, 7-day forecast, rain signal, heat/frost flags, and watering guidance. Use for watering, planting timing, heat stress, frost concerns, or weekly care schedules. Do not call for timeless design questions unless weather affects the answer.`,
    input_schema: {
      type: "object",
      properties: {
        zip_code: { type: "string" },
        latitude: { type: "number" },
        longitude: { type: "number" }
      },
      required: []
    }
  },
  {
    name: "lookup_plant_database",
    description: `Searches JarDIYn's curated plant intelligence cache for plants matched to zone, soil, sun, water, maintenance, and goals. Use for plant recommendations, nursery lists, substitutions, pollinator palettes, native alternatives, and avoid lists. Do not use for disease diagnosis; use diagnose_plant_issue instead.`,
    input_schema: {
      type: "object",
      properties: {
        hardiness_zone: { type: "string" },
        soil_type: { type: "string" },
        sun_exposure: { type: "string" },
        water_needs: { type: "string", enum: ["low", "medium", "high", "unknown"] },
        maintenance_tolerance: { type: "string" },
        goals: { type: "array", items: { type: "string" } },
        search_query: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "diagnose_plant_issue",
    description: `Provides cautious plant problem triage from symptoms, context, and Garden Passport data. Use when the user describes yellowing, spots, wilting, bugs, disease, poor growth, plant death, or asks what went wrong. It is triage, not a guaranteed diagnosis.`,
    input_schema: {
      type: "object",
      properties: {
        symptom_description: { type: "string" },
        plant_name: { type: "string" },
        soil_type: { type: "string" },
        sun_exposure: { type: "string" },
        watering_pattern: { type: "string" },
        drainage: { type: "string" }
      },
      required: ["symptom_description"]
    }
  },
  {
    name: "plan_check",
    description: `Checks a user's garden idea or plan for likely failure points, safety risks, mismatches with the Garden Passport, missing context, and better next steps. Use when the user asks if a plan is good, realistic, risky, or what will fail.`,
    input_schema: {
      type: "object",
      properties: {
        plan_text: { type: "string" },
        garden_profile: { type: "object" }
      },
      required: ["plan_text"]
    }
  },
  {
    name: "generate_garden_plan",
    description: `Generates a complete practical Garden Plan with Site Summary, Recommended Plants, Avoid List, Soil Prep, Watering Guidance, Weekend Tasks, Shopping List, Safety Notes, Sources Used, Questions for Local Nursery, and When to Call a Professional. Use when the user explicitly wants a plan, report, shopping list, or full next-step package.`,
    input_schema: {
      type: "object",
      properties: {
        garden_profile: { type: "object" },
        plan_goal: { type: "string" }
      },
      required: ["garden_profile"]
    }
  },
  {
    name: "property_gis_preview",
    description: `Roadmap-only preview of future Property Passport / municipal GIS import. Use only to explain future GIS, parcel, satellite, drone, or OSINT add-ons. Do not imply GIS upload is live.`,
    input_schema: {
      type: "object",
      properties: {
        property_context: { type: "string" }
      },
      required: []
    }
  }
];

export const TOOL_LABELS = Object.freeze({
  get_garden_zone: "Zone & Season Context",
  get_soil_profile: "Soil Profile",
  get_weather_context: "Weather & Watering Context",
  lookup_plant_database: "Plant Match",
  diagnose_plant_issue: "Plant Problem Triage",
  plan_check: "Plan Check",
  generate_garden_plan: "Garden Plan Builder",
  property_gis_preview: "Property Intelligence Roadmap"
});

export function publicToolRegistry() {
  return JARDIYN_TOOLS.map(tool => ({
    name: tool.name,
    label: TOOL_LABELS[tool.name] || tool.name,
    description: tool.description.replace(/\s+/g, " ").trim(),
    status: tool.name === "property_gis_preview" ? TOOL_STATUS.FUTURE_ROADMAP : TOOL_STATUS.LIVE_OR_FALLBACK,
    inputFields: Object.keys(tool.input_schema?.properties || {})
  }));
}
