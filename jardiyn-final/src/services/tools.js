export const TOOL_VERSION = "fable5-mythos-enterprise-complete-v5.2";

export const toolCategories = {
  profile: {
    label: "Garden Passport",
    description: "Location, hardiness zone, garden constraints, and site identity."
  },
  conditions: {
    label: "Live Conditions",
    description: "Weather, NOAA/NWS alerts, frost, pollen, rainfall, and watering signals."
  },
  soil: {
    label: "Soil Intelligence",
    description: "Soil texture, drainage, pH tendency, amendments, compaction, and watering behavior."
  },
  plants: {
    label: "Plant Intelligence",
    description: "Plant fit, lookup, local observations, diagnosis, and care guidance."
  },
  planning: {
    label: "Plans & Workflows",
    description: "Garden plans, DIY reports, schedules, and property-scale previews."
  }
};

export const tools = [
  {
    name: "get_garden_zone",
    category: "profile",
    risk: "low",
    live_provider: "ZIP centroid + USDA/PHZM-ready adapter",
    description: "Resolve garden location, hardiness zone, regional timing, and local context from ZIP or saved garden profile.",
    input_schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        zip_code: { type: "string", pattern: "^[0-9]{5}$" },
        location: { type: "string", maxLength: 120 }
      }
    }
  },
  {
    name: "get_weather_forecast",
    category: "conditions",
    risk: "low",
    live_provider: "Open-Meteo + NOAA-ready adapter",
    description: "Fetch garden-relevant current and 7-day weather: temperature, rain, wind, humidity, and outdoor work windows.",
    input_schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        zip_code: { type: "string", pattern: "^[0-9]{5}$" },
        days: { type: "integer", minimum: 1, maximum: 10, default: 7 }
      }
    }
  },
  {
    name: "get_noaa_alerts",
    category: "conditions",
    risk: "medium",
    live_provider: "NOAA/National Weather Service alerts API",
    description: "Check NOAA/NWS watches, warnings, advisories, frost/freeze alerts, wind, heat, storm, and severe weather risks.",
    input_schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        zip_code: { type: "string", pattern: "^[0-9]{5}$" },
        point: { type: "object" }
      }
    }
  },
  {
    name: "get_frost_alerts",
    category: "conditions",
    risk: "medium",
    live_provider: "NOAA/NWS alerts + Open-Meteo minimum temperature",
    description: "Check frost/freeze risk and generate protection actions for tender plants, seedlings, containers, and new transplants.",
    input_schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        zip_code: { type: "string", pattern: "^[0-9]{5}$" },
        crop_sensitivity: { type: "string", enum: ["tender", "moderate", "hardy", "unknown"], default: "unknown" }
      }
    }
  },
  {
    name: "get_pollen_forecast",
    category: "conditions",
    risk: "low",
    live_provider: "Open-Meteo Air Quality pollen adapter",
    description: "Check tree, grass, and weed pollen signals and translate them into garden work timing and pollinator context.",
    input_schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        zip_code: { type: "string", pattern: "^[0-9]{5}$" },
        focus: { type: "string", enum: ["tree", "grass", "weed", "general"], default: "general" }
      }
    }
  },
  {
    name: "get_recent_rainfall",
    category: "conditions",
    risk: "low",
    live_provider: "Open-Meteo Archive rainfall adapter",
    description: "Estimate recent rainfall and convert it into practical watering guidance by bed type, soil, containers, and plant maturity.",
    input_schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        zip_code: { type: "string", pattern: "^[0-9]{5}$" },
        days: { type: "integer", minimum: 1, maximum: 30, default: 14 },
        soil: { type: "string", maxLength: 80 }
      }
    }
  },
  {
    name: "get_soil_profile",
    category: "soil",
    risk: "low",
    live_provider: "SoilGrids/ISRIC-ready adapter + user soil profile",
    description: "Estimate soil texture, drainage, pH tendency, organic matter needs, compaction risk, and practical amendments.",
    input_schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        zip_code: { type: "string", pattern: "^[0-9]{5}$" },
        soil: { type: "string", maxLength: 80 },
        known_problems: { type: "string", maxLength: 800 },
        drainage: { type: "string", enum: ["unknown", "good", "slow", "poor"] }
      }
    }
  },
  {
    name: "lookup_plant_database",
    category: "plants",
    risk: "low",
    live_provider: "OpenFarm + iNaturalist-ready adapter",
    description: "Look up plant fit, care profile, zone match, sun/soil fit, maintenance level, and known risks.",
    input_schema: {
      type: "object",
      required: ["query"],
      additionalProperties: true,
      properties: {
        query: { type: "string", maxLength: 120 },
        zone: { type: "string", maxLength: 20 },
        sun: { type: "string", maxLength: 80 },
        soil: { type: "string", maxLength: 80 }
      }
    }
  },
  {
    name: "diagnose_plant_issue",
    category: "plants",
    risk: "medium",
    live_provider: "symptom triage + vision-ready adapter",
    description: "Diagnose likely plant issues from symptoms, site context, and optional photo metadata. Produces safe first actions, not overconfident diagnosis.",
    input_schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        symptoms: { type: "string", maxLength: 1200 },
        plant: { type: "string", maxLength: 120 },
        photo_context: { type: "string", maxLength: 400 },
        zip_code: { type: "string", pattern: "^[0-9]{5}$" }
      }
    }
  },
  {
    name: "generate_garden_plan",
    category: "planning",
    risk: "medium",
    live_provider: "JarDIYn planning engine + condition dependencies",
    description: "Generate a practical garden plan using zone, soil, weather, NOAA/frost risk, pollen, rainfall, goals, budget, and known constraints.",
    input_schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        profile: { type: "object" },
        horizon: { type: "string", enum: ["weekend", "week", "month", "season"], default: "month" }
      }
    }
  },
  {
    name: "generate_diy_report",
    category: "planning",
    risk: "medium",
    live_provider: "JarDIYn reporting engine",
    description: "Create a weekly, monthly, or seasonal DIY garden report with priorities, risks, timing windows, and follow-up tasks.",
    input_schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        profile: { type: "object" },
        timeframe: { type: "string", enum: ["week", "month", "season"], default: "week" }
      }
    }
  },
  {
    name: "property_gis_preview",
    category: "planning",
    risk: "medium",
    live_provider: "GIS/photo-ready preview adapter",
    description: "Generate property-scale site notes: sun assumptions, slope/drainage risk, access, utility caution, and spatial planning hooks.",
    input_schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        zip_code: { type: "string", pattern: "^[0-9]{5}$" },
        site_notes: { type: "string", maxLength: 1000 },
        goals: { type: "array", items: { type: "string" } }
      }
    }
  }
];

export function getTools() { return tools.map((tool) => ({ ...tool })); }
export function getTool(name) { return tools.find((tool) => tool.name === name) || null; }
export function getToolNames() { return tools.map((tool) => tool.name); }
export function toAnthropicTool(tool) { return { name: tool.name, description: tool.description, input_schema: tool.input_schema }; }
export function getToolsByCategory() {
  const grouped = {};
  for (const [key, meta] of Object.entries(toolCategories)) grouped[key] = { ...meta, tools: [] };
  for (const tool of tools) grouped[tool.category]?.tools.push(tool);
  return grouped;
}
export function publicToolRegistry() {
  return { version: TOOL_VERSION, count: tools.length, categories: getToolsByCategory(), tools: getTools() };
}
